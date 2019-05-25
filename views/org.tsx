import * as React from "react";

export interface ActionableFingerprintForDisplay {
    featureName: string;
    name: string;
    appearsIn: number; // count of projects
    variants: number;
    ideal?: { ideal?: { name: string, data: string } };
}
export interface OrgExplorerProps {
    features: { projectsAnalyzed: number };
    actionableFingerprints: ActionableFingerprintForDisplay[];

}

function actionableFingerprintListItem(af: ActionableFingerprintForDisplay): React.ReactElement {
    const queryLink = `./query?name=${af.name}&byOrg=true`;
    let idealDisplay = <span></span>;
    if (af.ideal && af.ideal.ideal) {
        const idealQueryLink = `./query?name=${af.ideal.ideal.name}-ideal&byOrg=true`;
        idealDisplay = <span>
            -
            <a href={idealQueryLink}> Progress toward ideal
         <b>{af.ideal.ideal.data}</b>
            </a>
        </span>;
    }

    return <li key={af.name}><i>{af.featureName}:
                {af.name}</i>: {af.appearsIn} projects, {" "}
        <a href={queryLink}>{af.variants} variants</a>
        {idealDisplay}
    </li>;
}

export function OrgExplorer(props: OrgExplorerProps): React.ReactElement {
    return <div>
        <a href="./projects">{props.features.projectsAnalyzed} projects </a>
        <h2>Action Items</h2>
        <div className="actionItemBox">
            <ul>
                {props.actionableFingerprints.map(actionableFingerprintListItem)}
            </ul>
        </div>
    </div>;
}
        /*

{{#each actionableFingerprints}}
<li><i>{{ this.featureName }}:
{{ this.name }}</i>: {{ this.appearsIn }} projects,

<a href="./query?name={{this.name}}&byOrg=true">{{ this.variants }} variants</a>
{{#if this.ideal }}
- <a href="./query?name={{this.name}}-ideal&byOrg=true">Progress toward ideal <b>{{ this.ideal.data }}</b></a>
{{/if}}
</li>
{{/ each}}

<h2>Features</h2>

{{#each importantFeatures.features}}
<h3>{{ this.feature.displayName }}</h3>

{{#each this.fingerprints}}

<li><i>{{#if this.displayName }}{{ this.displayName }}{{ else}}{{ this.name }}{{/if}}</i>: {{ this.appearsIn }} projects,

<a href="./query?name={{this.name}}&byOrg=true">{{ this.variants }} variants</a>
{{#if this.ideal }}
- <a href="./query?name={{this.name}}-ideal&byOrg=true">Progress toward ideal <b>{{ this.ideal.data }}</b></a>
{{/if}}
</li>
{{/ each}}

{{/ each}}

<h2>Common queries</h2>

<h3>Community</h3>
<li><a href="./query?name=path&path=elements.codeOfConduct.name&byOrg=true&otherLabel=No Code of Conduct :-(">Code of
Conduct</a></li>

<h3>Code</h3>
<li><a href="./query?name=langs&byOrg=true">Language breakdown for all projects</a></li>
<li><a href="./query?name=loc&byOrg=true">Repo sizes</a></li>
<li><a href="./query?name=dependencyCount&byOrg=true">Number of dependencies</a></li>
<li><a href="./query?name=licenses&byOrg=true">package.json license</a></li>

<!--<form method="GET" action="/query/libraryVersions">-->
<!--<li>Artifact: <input id="artifact" name="artifact" value="@atomist/microgrammar" />-->
<!--<input type="checkbox" name="otherLabel" value="unused">Show all-->
<!--<input type="checkbox" checked="true" name="byOrg" value="true">By org-->
<!--<input type="submit" value="Search" />-->
<!--</form>-->

<h3>Docker</h3>
<li><a href="./query?name=docker&byOrg=true">Docker Yes/No</a></li>
<li><a href="./query?name=path&path=elements.docker.dockerFile.path&unused=No+Docker">Docker file path</a></li>
<li><a href="./query?name=dockerPorts&byOrg=true">Exposed Docker ports</a></li>

<h3>Atomist Status</h3>
<li><a href="./query?name=uhura&byOrg=true">Uhura delivery status</a></li>

<h2>Technology identified</h2>
<form method="GET" action="./query?name=using">
Technology: <input id="what" name="list" value="node,springboot" />
<input type="submit" value="Search" />
</form>

<h2>Custom path</h2>

<form method="GET" action="./query?name=path">
Path: <input id="what" name="path" size="50" value="elements.node.typeScript.tslint.hasConfig" />
<input type="checkbox" name="otherLabel" value="irrelevant">Show all
<input type="submit" value="Search" />
</form>

<h2>Data</h2>
<a href="http://localhost:2866/querydata/typeScriptVersions">Example of backing JSON data</a>
</div>
}
*/
