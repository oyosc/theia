/********************************************************************************
 * Copyright (C) 2020 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

/**
 * This script generates tsconfig references between our workspaces.
 *
 * `tsc` build mode relies on these references to build out of date dependencies
 * only when required, but it cannot infer workspaces by itself, it has to be
 * explicitly defined.
 *
 * See: https://www.typescriptlang.org/docs/handbook/project-references.html
 */

// @ts-check

const cp = require('child_process');
const path = require('path').posix;
const fs = require('fs');

const CWD = path.join(__dirname, '..');

const YARN_WORKSPACES = JSON.parse(cp.execSync('yarn --silent workspaces info --json').toString());

for (const packageName of Object.keys(YARN_WORKSPACES)) {
    const workspacePackage = YARN_WORKSPACES[packageName];
    compileReferences(workspacePackage);
}
compileReferences({
    location: '.', // root package of the monorepo
    workspaceDependencies: Object.keys(YARN_WORKSPACES),
});

function compileReferences(currentPackage) {
    const tsconfigPath = path.join(CWD, currentPackage.location, 'tsconfig.json');
    // If no tsconfig, no need to edit references...
    if (!fs.existsSync(tsconfigPath)) {
        return;
    }
    let needRewrite = false;
    const tsconfigJson = require(tsconfigPath);
    if (!tsconfigJson.compilerOptions) {
        tsconfigJson.compilerOptions = {
            composite: true,
            rootDir: 'src',
            outDir: 'lib',
        };
    } else if (!tsconfigJson.compilerOptions.composite) {
        tsconfigJson.compilerOptions = {
            composite: true,
            ...tsconfigJson.compilerOptions,
        };
        needRewrite = true;
    }
    const dependencies = currentPackage.workspaceDependencies || [];
    const references = new Set((tsconfigJson['references'] || []).map(reference => reference.path));
    for (const dependency of dependencies) {
        if (dependency in YARN_WORKSPACES) {
            const depWorkspace = YARN_WORKSPACES[dependency];
            const depConfig = path.join(depWorkspace.location, 'tsconfig.json');
            if (!fs.existsSync(depConfig)) {
                continue;
            }
            const relativePath = path.relative(currentPackage.location, depWorkspace.location);
            if (!references.has(relativePath)) {
                needRewrite = true;
            }
            references.add(relativePath);
        }
    }
    if (needRewrite) {
        tsconfigJson.references = []
        for (const reference of references.keys()) {
            tsconfigJson.references.push({
                path: reference,
            });
        }
        const content = JSON.stringify(tsconfigJson, undefined, 2);
        fs.writeFileSync(tsconfigPath, content + '\n');
    }
}
