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
 * This script generates tsconfig references between our workspaces, it also
 * configures our .eslintrc file to use such references.
 *
 * `tsc` build mode relies on these references to build out of date dependencies
 * only when required, but it cannot infer workspaces by itself, it has to be
 * explicitly defined [1].
 *
 * [1]: https://www.typescriptlang.org/docs/handbook/project-references.html
 */

// @ts-check

const cp = require('child_process');
const path = require('path').posix;
const fs = require('fs');

const CWD = path.join(__dirname, '..');

const FORCE_REWRITE = Boolean(process.env['THEIA_REPO_FORCE_REWRITE']);

/** @type {{ [packageName: string]: YarnWorkspace }} */
const YARN_WORKSPACES = JSON.parse(cp.execSync('yarn --silent workspaces info').toString());

/** @type {YarnWorkspace} */
const THEIA_MONOREPO = {
    workspaceDependencies: Object.keys(YARN_WORKSPACES),
    location: '.',
};

{
    for (const packageName of Object.keys(YARN_WORKSPACES)) {
        const workspacePackage = YARN_WORKSPACES[packageName];
        const tsconfigPath = path.join(CWD, workspacePackage.location, 'tsconfig.json');
        const references = getTypescriptReferences(workspacePackage);
        configureTypeScriptConfig(tsconfigPath, references);
    }
    const tsconfigPath = path.join(CWD, 'tsconfig.json');
    const references = getTypescriptReferences(THEIA_MONOREPO);
    configureTypeScriptConfig(tsconfigPath, references);
}

/**
 * @param {YarnWorkspace} requestedPackage
 * @returns {string[]} references for `requestedPackage`
 */
function getTypescriptReferences(requestedPackage) {
    const references = []
    const dependencies = requestedPackage.workspaceDependencies || []
    for (const dependency of dependencies) {
        if (dependency in YARN_WORKSPACES) {
            const depWorkspace = YARN_WORKSPACES[dependency];
            const depConfig = path.join(depWorkspace.location, 'tsconfig.json');
            if (!fs.existsSync(depConfig)) {
                continue;
            }
            const relativePath = path.relative(requestedPackage.location, requestedPackage.location);
            references.push(relativePath);
        }
    }
    return references;
}

/**
 * @param {string} tsconfigPath
 * @param {string[]} references
 */
function configureTypeScriptConfig(tsconfigPath, references) {
    if (!fs.existsSync(tsconfigPath)) {
        return;
    }
    let needRewrite = false;
    const tsconfigJson = readJsonFile(tsconfigPath);
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
    const currentReferences = new Set((tsconfigJson['references'] || []).map(reference => reference.path));
    for (const reference of references) {
        if (!currentReferences.has(reference)) {
            currentReferences.add(reference);
            needRewrite = true;
        }
    }
    if (FORCE_REWRITE || needRewrite) {
        tsconfigJson.references = []
        for (const reference of currentReferences) {
            tsconfigJson.references.push({
                path: reference,
            });
        }
        const content = JSON.stringify(tsconfigJson, undefined, 2);
        fs.writeFileSync(tsconfigPath, content + '\n');
    }
}

/**
 * @param {string} path
 * @returns {any}
 */
function readJsonFile(path) {
    return JSON.parse(fs.readFileSync(path).toString());
}

/**
 * @typedef YarnWorkspace
 * @property {string} location
 * @property {string[]} workspaceDependencies
 */
