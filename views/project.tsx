import * as React from "react";
import { ProjectAnalysisResult } from "../lib/analysis/ProjectAnalysisResult";

type DisplayName = string;

export interface ProjectFingerprintForDisplay {
    displayName: DisplayName;
    idealDisplayString: string;
    displayValue: string;
    style: React.CSSProperties;
}

export interface ProjectFeatureForDisplay {
    feature: { displayName: DisplayName };
    fingerprints: ProjectFingerprintForDisplay[];
}

export interface ProjectExplorerProps {
    analysisResult: ProjectAnalysisResult;
    features: ProjectFeatureForDisplay[];
}

export function ProjectExplorer(props: ProjectExplorerProps): React.ReactElement {
    return <div>
        <h1>Project {props.analysisResult.repoRef.owner}:{props.analysisResult.repoRef.repo}</h1>

        <a href={props.analysisResult.repoRef.url}>Source</a>

        <h2>Architectural Concerns</h2>

        {props.features.map(displayFeature)}
    </div>;
}

function displayFeature(feature: ProjectFeatureForDisplay): React.ReactElement {
    return <div>
        <h3>{feature.feature.displayName}</h3>
        <ul>
            {feature.fingerprints.map(displayFingerprint)}
        </ul>
    </div>;
}

function displayFingerprint(fingerprint: ProjectFingerprintForDisplay): React.ReactElement {
    return <li style={fingerprint.style} key={fingerprint.displayName}>
        <i>{fingerprint.displayName}</i>: {fingerprint.displayValue}
        {" "} (Ideal: {fingerprint.idealDisplayString || "none"})
    </li>;
}
