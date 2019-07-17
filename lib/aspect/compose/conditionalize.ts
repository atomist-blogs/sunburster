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

import { Project } from "@atomist/automation-client";
import { Aspect } from "@atomist/sdm-pack-fingerprints";

// TODO move to fingerprints pack

/**
 * Make this aspect conditional
 */
export function conditionalize(f: Aspect,
                               test: (p: Project) => Promise<boolean>,
                               details: Partial<Pick<Aspect, "name" | "displayName" |
                                   "toDisplayableFingerprint" | "toDisplayableFingerprintName">> = {}): Aspect {
    return {
        ...f,
        ...details,
        extract: async p => {
            const testResult = await test(p);
            return testResult ?
                {
                    // We need to put in the new name if it's there
                    ...f.extract(p),
                    ...details,
                } :
                undefined;
        },
    };
}
