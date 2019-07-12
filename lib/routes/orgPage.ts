/*
 * Copyright © 2019 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { logger } from "@atomist/automation-client";
import { ExpressCustomizer } from "@atomist/automation-client/lib/configuration";
import {
    ConcreteIdeal,
    Ideal,
    isConcreteIdeal,
} from "@atomist/sdm-pack-fingerprints";
import * as bodyParser from "body-parser";
import {
    Express,
    RequestHandler,
} from "express";
import * as _ from "lodash";
import {
    CSSProperties,
    ReactElement,
} from "react";
import * as ReactDOMServer from "react-dom/server";
import serveStatic = require("serve-static");
import { FeatureForDisplay, ManagedFeatureForDisplay, OrgExplorer } from "../../views/org";
import {
    ProjectExplorer, ProjectFeatureForDisplay,
} from "../../views/project";
import {
    ProjectForDisplay,
    ProjectList,
} from "../../views/projectList";
import {
    CurrentIdealForDisplay,
    PossibleIdealForDisplay,
    SunburstQuery,
} from "../../views/sunburstQuery";
import { TopLevelPage } from "../../views/topLevelPage";
import { ProjectAnalysisResultStore } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import {
    defaultedToDisplayableFingerprint,
    defaultedToDisplayableFingerprintName,
    MelbaFingerprintForDisplay,
} from "../feature/DefaultFeatureManager";
import {
    FeatureManager,
    ManagedFeature,
} from "../feature/FeatureManager";
import { reportersAgainst } from "../feature/reportersAgainst";
import { WellKnownReporters } from "./wellKnownReporters";

function renderStaticReactNode(body: ReactElement,
                               title?: string,
                               extraScripts?: string[]): string {
    return ReactDOMServer.renderToStaticMarkup(
        TopLevelPage({
            bodyContent: body,
            pageTitle: title,
            extraScripts,
        }));
}

/**
 * Add the org page route to Atomist SDM Express server.
 * @return {ExpressCustomizer}
 */
export function orgPage(featureManager: FeatureManager, store: ProjectAnalysisResultStore): ExpressCustomizer {
    return (express: Express, ...handlers: RequestHandler[]) => {
        express.use(bodyParser.json());       // to support JSON-encoded bodies
        express.use(bodyParser.urlencoded({     // to support URL-encoded bodies
            extended: true,
        }));

        express.use(serveStatic("public", { index: false }));

        /* redirect / to the org page. This way we can go right here
         * for now, and later make a higher-level page if we want.
         */
        express.get("/", ...handlers, async (req, res) => {
            res.redirect("/org");
        });
        /* the org page itself */
        express.get("/org", ...handlers, async (req, res) => {
            try {
                const repos = await store.loadWhere(whereFor(req));

                const fingerprintUsage = await store.fingerprintUsageForType("*");

                const actionableFingerprints = [];
                // allManagedFingerprints(fingerprintCensus)
                    // .filter(mf => mf.variants > fingerprintCensus.projectsAnalyzed / 10)
                    // .sort((a, b) => b.appearsIn - a.appearsIn)
                    // .sort((a, b) => b.variants - a.variants);

                const importantFeatures: FeatureForDisplay[] = featureManager.features
                    .filter(f => !!f.displayName)
                    .filter(f => fingerprintUsage.some(fu => fu.type === f.name))
                    .map(feature => ({
                        feature,
                        fingerprints: fingerprintUsage.filter(fu => fu.type === feature.name)
                            .map(fu => ({
                                ...fu,
                                featureName: feature.name,
                            })),
                    }));

                const unfoundFeatures: ManagedFeatureForDisplay[] = featureManager.features
                    .filter(f => !!f.displayName)
                    .filter(f => !fingerprintUsage.some(fu => fu.type === f.name));

                res.send(renderStaticReactNode(OrgExplorer({
                    actionableFingerprints,
                    projectsAnalyzed: repos.length,
                    importantFeatures,
                    unfoundFeatures,
                    projects: repos.map(r => ({ ...r.repoRef, id: r.id })),
                })));
            } catch (e) {
                logger.error(e.stack);
                res.status(500).send("failure");
            }
        });

        /* Project list page */
        express.get("/projects", ...handlers, async (req, res) => {
            const allAnalysisResults = await store.loadWhere(whereFor(req));

            // optional query parameter: owner
            const relevantAnalysisResults = allAnalysisResults.filter(ar => req.query.owner ? ar.analysis.id.owner === req.query.owner : true);
            if (relevantAnalysisResults.length === 0) {
                return res.send(`No matching repos for organization ${req.query.owner}`);
            }

            const projectsForDisplay: ProjectForDisplay[] = relevantAnalysisResults.map(ar => ({ id: ar.id, ...ar.analysis.id }));

            return res.send(renderStaticReactNode(
                ProjectList({ projects: projectsForDisplay }),
                "Project list"));
        });

        /* the project page */
        express.get("/project", ...handlers, async (req, res) => {
            const id = req.query.id;
            const analysisResult = await store.loadById(id);
            if (!analysisResult) {
                return res.send(`No project at ${JSON.stringify(id)}`);
            }

            const featuresAndFingerprints = await featureManager.projectFingerprints(await store.fingerprintsForProject(id));

            // assign style based on ideal
            const ffd: ProjectFeatureForDisplay[] = featuresAndFingerprints.map(featureAndFingerprints => ({
                ...featureAndFingerprints,
                fingerprints: featureAndFingerprints.fingerprints.map(fp => ({
                    ...fp,
                    idealDisplayString: displayIdeal(fp, featureAndFingerprints.feature),
                    style: displayStyleAccordingToIdeal(fp),
                })),
            }));

            return res.send(renderStaticReactNode(ProjectExplorer({
                analysisResult,
                features: _.sortBy(ffd.filter(f => !!f.feature.displayName), f => f.feature.displayName),
            })));
        });

        /* the query page */
        express.get("/query", ...handlers, async (req, res) => {
            let dataUrl: string;
            let currentIdealForDisplay: CurrentIdealForDisplay;
            const possibleIdealsForDisplay: PossibleIdealForDisplay[] = [];

            let fingerprintDisplayName: string = "";
            const workspaceId = req.query.workspaceId || "*";

            if (req.query.skew) {
                dataUrl = `/api/v1/${workspaceId}/filter/skew`;
            } else {
                const fingerprintName = req.query.name.replace(/-ideal$/, "");

                const queryString = jsonToQueryString(req.query);
                if (req.query.name === "*") {
                    dataUrl = `/api/v1/${workspaceId}/filter/featureReport?${queryString}`;
                } else {
                    const featureQueries = await reportersAgainst(
                        () => store.distinctFingerprintKinds(workspaceId),
                        featureManager);
                    const allQueries = _.merge(featureQueries, WellKnownReporters);
                    const cannedQueryDefinition = allQueries[req.query.name];
                    if (!cannedQueryDefinition) {
                        return res.render("noQuery", {
                            query: req.query.name,
                        });
                    }

                    dataUrl = !!req.query.filter ?
                        `/api/v1/${workspaceId}/filter/${req.query.name}?${queryString}` :
                        `/api/v1/${workspaceId}/fingerprint/${
                        encodeURIComponent(req.query.type)}/${
                        encodeURIComponent(req.query.name)}?byOrg=${req.query.byOrg === "true"}`;
                }

                // tslint:disable-next-line
                const feature = featureManager.featureFor(req.query.type);
                fingerprintDisplayName = defaultedToDisplayableFingerprintName(feature)(fingerprintName);

                function idealDisplayValue(ideal: Ideal | undefined): CurrentIdealForDisplay | undefined {
                    if (!ideal) {
                        return undefined;
                    }
                    if (!isConcreteIdeal(ideal)) {
                        return { displayValue: "eliminate" };
                    }
                    return { displayValue: defaultedToDisplayableFingerprint(feature)(ideal.ideal) };
                }

                currentIdealForDisplay = idealDisplayValue(await featureManager.idealStore
                    .loadIdeal("local", req.query.type, fingerprintName));
            }
            logger.info("Data url=%s", dataUrl);

            res.send(renderStaticReactNode(
                SunburstQuery({
                    fingerprintDisplayName,
                    currentIdeal: currentIdealForDisplay,
                    possibleIdeals: possibleIdealsForDisplay,
                    query: req.params.query,
                    dataUrl,
                }),
                "Atomist Aspect",
                [
                    "/lib/d3.v4.min.js",
                    "/js/sunburst.js",
                ]));
        });

    };
}

export function whereFor(req): string {
    const wsid = req.query.workspace || req.params.workspace_id;
    if (wsid === "*") {
        return "true";
    }
    return wsid ? `workspace_id = '${wsid}'` : "true";
}

export function jsonToQueryString(json: object): string {
    return Object.keys(json).map(key =>
        encodeURIComponent(key) + "=" + encodeURIComponent(json[key]),
    ).join("&");
}

function displayIdeal(fingerprint: MelbaFingerprintForDisplay, feature: ManagedFeature): string {
    if (idealIsDifferentFromActual(fingerprint)) {
        return defaultedToDisplayableFingerprint(feature)((fingerprint.ideal as ConcreteIdeal).ideal);
    }
    if (idealIsElimination(fingerprint)) {
        return "eliminate";
    }
    return "";
}

function idealIsElimination(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && !isConcreteIdeal(fingerprint.ideal);
}

function idealIsDifferentFromActual(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && isConcreteIdeal(fingerprint.ideal) && fingerprint.ideal.ideal.sha !== fingerprint.sha;
}

function idealIsSameAsActual(fingerprint: MelbaFingerprintForDisplay): boolean {
    return fingerprint.ideal && isConcreteIdeal(fingerprint.ideal) && fingerprint.ideal.ideal.sha === fingerprint.sha;
}

function displayStyleAccordingToIdeal(fingerprint: MelbaFingerprintForDisplay): CSSProperties {
    const redStyle: CSSProperties = { color: "red" };
    const greenStyle: CSSProperties = { color: "green" };

    if (idealIsSameAsActual(fingerprint)) {
        return greenStyle;
    }
    if (idealIsDifferentFromActual(fingerprint)) {
        return redStyle;
    }
    if (idealIsElimination(fingerprint)) {
        return redStyle;
    }
    return {};
}
