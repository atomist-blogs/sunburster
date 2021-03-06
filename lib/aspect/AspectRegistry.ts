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

import {
    RepoRef,
    Severity,
} from "@atomist/automation-client";
import { FP } from "@atomist/sdm-pack-fingerprint";
import { Aspect } from "@atomist/sdm-pack-fingerprint/lib/machine/Aspect";
import { FingerprintUsage } from "../analysis/offline/persist/ProjectAnalysisResultStore";
import { ProjectAnalysisResult } from "../analysis/ProjectAnalysisResult";
import {
    Scorer,
    ScorerReturn,
    WeightedScore,
} from "../scorer/Score";

/**
 * Implemented by ProjectAnalysis or any other structure
 * representing a repo exposing fingerprint data
 */
export interface HasFingerprints {
    fingerprints: FP[];
}

/**
 * Result of an analysis. We must always have at least fingerprints and repo identification
 */
export type Analyzed = HasFingerprints & { id: RepoRef };

/**
 * Result of an analysis on a workspace. We must always have at least fingerprints and repo identification
 */
export type AnalyzedWorkspace = HasFingerprints & { id: RepoRef, workspaceId: string };

/**
 * Tag based on fingerprint data.
 */
export interface Tag {

    name: string;

    /**
     * Name of parent tag
     */
    parent?: string;

    description?: string;

    /**
     * Severity if this tag is associated with an action
     */
    severity?: Severity;
}

export type TagTest = (repoToScore: RepoToScore) => Promise<boolean>;

/**
 * Determine zero or one tag in this fingerprint.
 */
export interface Tagger extends Tag {

    /**
     * Test for the relevance of this tag. Invoked on every fingerprint
     * on each project.
     */
    test: TagTest;
}

/**
 * Implemented by objects that can create tag tests. Tag information is
 * known in advance. Tests are dynamically created.
 */
export interface WorkspaceSpecificTagger extends Tag {

    createTest(workspaceId: string, ar: AspectRegistry): Promise<TagTest>;
}

/**
 * Tagger that can apply to all workspaces or workspace-specific tagger
 */
export type TaggerDefinition = Tagger | WorkspaceSpecificTagger;

export function isTagger(t: TaggerDefinition): t is Tagger {
    const maybe = t as Tagger;
    return !!maybe.test;
}

export type TaggedRepo = RepoToScore & { tags?: Tag[] };

export type ScoredRepo = TaggedRepo & { weightedScore: WeightedScore };

export type RepoToScore = Pick<ProjectAnalysisResult, "analysis" | "id">;

/**
 * Scoring repository based on
 * fingerprints that have previously been extracted by aspects.
 * @param repo repo we are scoring
 * @param allRepos context of this scoring activity
 * @return undefined if this scorer doesn't know how to score this repository.
 * Otherwise return a score.
 */
export interface RepositoryScorer extends Scorer {

    /**
     * Does this scorer apply only to the root of a repository, rather than multiple subprojects?
     * See Aspect.baseOnly
     */
    readonly baseOnly?: boolean;

    /**
     * If this is turned off, show all fingerprints, not just limited to current path.
     * Means that baseOnly is irrelevant. Will run only once on all fingerprints in all cases.
     */
    readonly scoreAll?: boolean;

    /**
     * Function that knows how to score a repository.
     * @param repo repo we are scoring
     * @param allRepos context of this scoring activity
     * @return undefined if this scorer doesn't know how to score this repository.
     */
    scoreFingerprints: (r: RepoToScore) => Promise<ScorerReturn>;

}

export interface TagAndScoreOptions {

    /**
     * If this is set, score only for this category
     * '*' means all
     */
    readonly category?: string;
}

/**
 * Information on which we'll score an organization
 */
export interface WorkspaceToScore {

    /**
     * Information about this organization
     */
    fingerprintUsage: FingerprintUsage[];

    /**
     * Repos that have already been scored
     */
    repos: Array<{
        url: string;
        repo: string;
        owner: string;
        score?: number;
    }>;
}

export interface WorkspaceScorer extends Scorer {

    /**
     * Function that knows how to score an org.
     * @param repo repo we are scoring
     * @param allRepos context of this scoring activity
     * @return undefined if this scorer doesn't know how to score this repository.
     */
    score: (od: WorkspaceToScore) => Promise<ScorerReturn>;

}

/**
 * Manage a number of aspects.
 */
export interface AspectRegistry {

    scoreWorkspace(workspaceId: string, workspaceToScore: WorkspaceToScore): Promise<WeightedScore>;

    tagAndScoreRepos(workspaceId: string,
                     repos: ProjectAnalysisResult[],
                     opts: TagAndScoreOptions): Promise<ScoredRepo[]>;

    availableTags: Tag[];

    /**
     * All the aspects we are managing
     */
    readonly aspects: Aspect[];

    /**
     * Find the aspect that manages fingerprints of this type
     */
    aspectOf(type: string): Aspect | undefined;

}
