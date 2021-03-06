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
import * as _ from "lodash";
import {
    FingerprintKind,
    FingerprintUsage,
} from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { AspectRegistry } from "../aspect/AspectRegistry";
import {
    AspectReportDetails,
    AspectReportDetailsRegistry,
    AspectWithReportDetails,
} from "../aspect/AspectReportDetailsRegistry";

export interface ReportDetails extends AspectReportDetails {
    name?: string;
}

export interface AspectReport {
    category: string;
    count: number;
    aspects: ReportDetails[];
}

async function aspectReportDetailsOf(type: string,
                                     workspaceId: string,
                                     details: Record<string, AspectReportDetails>,
                                     aspectRegistry: AspectReportDetailsRegistry): Promise<AspectReportDetails> {
    if (!details[type]) {
        details[type] = await aspectRegistry.reportDetailsOf(type, workspaceId) || {};
    }
    return details[type];
}

export async function getAspectReports(fps: Array<{
                                           owner: string,
                                           repo: string,
                                           fingerprints: Array<FingerprintKind & { details: AspectReportDetails }>,
                                       }>,
                                       fus: FingerprintUsage[],
                                       aspectRegistry: AspectRegistry & AspectReportDetailsRegistry,
                                       workspaceId: string): Promise<AspectReport[]> {
    const aspects = aspectRegistry.aspects as AspectWithReportDetails[];
    const reports: AspectReport[] = [];
    const categories = [];
    const loadedDetails = {};

    const entropyCounts = _.sortBy(_.map(fus.reduce((p: any, c: any) => {
        const e = _.get(p, c.type, { zero: 0, low: 0, medium: 0, high: 0 });
        const band = c.entropyBand.toLowerCase();
        e[band] = (e[band] || 0) + 1;
        _.set(p, c.type, e);
        return p;
    }, {}), (v, k) => ({ ...(v), type: k })), "high", "medium", "low", "zero").reverse();

    for (const fu of fps) {
        for (const f of fu.fingerprints) {
            const details = await aspectReportDetailsOf(f.type, workspaceId, loadedDetails, aspectRegistry);
            f.details = details;
            categories.push(details.category);
        }
    }

    _.uniq(categories.filter(c => !!c)).forEach(k => {
        const fu = fps.filter(f => f.fingerprints.map(fp => fp.details.category).includes(k));
        if (fu.length > 0) {
            const allFps = _.uniqBy(
                _.flatten(
                    fu.map(f => f.fingerprints))
                    .filter(fp => fp.details.category === k), "type");
            reports.push({
                category: k,
                count: fu.length,
                aspects: _.uniqBy(allFps.map(f => {
                    const rd = f.details;
                    return {
                        name: (aspectRegistry.aspectOf(f.type) || {} as any).displayName || (rd as any).displayName,
                        type: (aspectRegistry.aspectOf(f.type) || {} as any).name || (rd as any).name,
                        description: rd.description,
                        shortName: rd.shortName,
                        unit: rd.unit,
                        url: `/api/v1/${workspaceId}/${rd.url}`,
                        manage: rd.manage !== undefined ? rd.manage : true,
                        order: entropyCounts.findIndex(e => e.type === f.type),
                        entropyBands: entropyCounts.find(e => e.type === f.type),
                    };
                }), "url")
                    .sort((r1, r2) => {
                        const i1 = aspects.findIndex(r => r.name === r1.type);
                        const i2 = aspects.findIndex(r => r.name === r2.type);
                        return i1 - i2;
                    }),
            });
        }
    });

    return reports.sort((r1, r2) => {
        const i1 = aspects.filter(a => a.details).findIndex(r => r.details.category === r1.category);
        const i2 = aspects.filter(a => a.details).findIndex(r => r.details.category === r2.category);
        return i1 - i2;
    });

}
