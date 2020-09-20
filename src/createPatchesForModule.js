const Diff = require('diff');
const fs = require("fs-extra");
const glob = require("fast-glob");
const { join, resolve, basename } = require("path");
const { ModuleFile } = require('./ModuleFile');
const DEFAULT_OPTIONS = require('./defaultOptions');

function concatUnique(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
        throw Error("both parameters must be arrays");
    }
    let arr = a.concat(b);
    let seen = {};
    return arr.filter(function (item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
}


/**
 * @param {string} relativeFilePath
 * @param {string} originalModuleDir
 * @param {string} modifiedModuleDir
 * @param {string} outputDir
 * @param {Object} patchInfo
 */

function createPatch(relativeFilePath, originalModuleDir, modifiedModuleDir, outputDir, patchInfo) {
    let originalFile = new ModuleFile(relativeFilePath, originalModuleDir, patchInfo.options);
    let projectFile = new ModuleFile(relativeFilePath, modifiedModuleDir, patchInfo.options);
    let patchFilePath = join(outputDir, relativeFilePath + ".patch");
    if (projectFile.exists) {
        let newFilePath = join(outputDir, relativeFilePath);
        // just copy new files.
        if (!originalFile.exists) {
            fs.ensureFileSync(newFilePath);
            fs.copyFileSync(projectFile.absolutePath, newFilePath);
        // If binary files differ, copy them.
        } else if (originalFile.encoding === "binary" && projectFile.encoding === "binary") {
            if (Buffer.compare(originalFile.data, projectFile.data) !== 0) {
                fs.ensureFileSync(newFilePath);
                fs.copyFileSync(projectFile.absolutePath, newFilePath);
            }
        // otherwise, if it's a text file, make a patch.
        } else if (originalFile.encoding === "utf8" && projectFile.encoding === "utf8") {
            let patch = Diff.createPatch(relativeFilePath, originalFile.data, projectFile.data);
            newFilePath += ".patch";
            if (Diff.parsePatch(patch)[0].hunks.length !== 0) {
                fs.ensureFileSync(newFilePath);
                fs.writeFileSync(patchFilePath, patch, { encoding: "utf8" });
            }
        } else {
            throw new Error(`Encodings differ between files?!\n${originalFile.relativePath}\n${projectFile.relativePath}`);
        }
    } else {
        if (patchInfo.options.deleteMissingFiles) {
            patchInfo.deletedFiles.push(relativeFilePath);
        }
    }
}

/**
 *
 * 
 * @param {string} originalModuleDir
 * @param {string} modifiedModuleDir
 * @param {string} outputDir
 * @param {Object} [options]
 * @param {{ [key: string]: string | number } | string} [options.versionInfo]
 * @param {string}  [options.patchFormat] patch format, only supports unified right now
 * @param {string}  [options.normalizeEOL] either "LF" or "CRLF"
 * @param {boolean} [options.copyNewFiles] copies files in modifiedModuleDir into patch directory 
 * @param {boolean} [options.copyBinaryFiles] copies changed binary files in modfiedModuleDir into patch directory
 * @param {boolean} [options.deleteMissingFiles] deletes missing files in modifiedModuleDir
 * @param {boolean} [options.skipNodeModules] skips node_modules
 */

async function createPatchesForModule(originalModuleDir, modifiedModuleDir, outputDir, options) {

    let moduleName = basename(outputDir);
    let patchInfoPath = join(resolve(outputDir, ".."), moduleName + "-patch-info.json");
    if (options.normalizeEOL !== 'LF' || options.normalizeEOL !== 'CLRF'){
        options.normalizeEOL = undefined;
    }
    let patchInfo = {
        module: moduleName,
        versionInfo: options.versionInfo || "none",
        options:{
            patchFormat: options.patchFormat || "unified",
            normalizeEOL: options.normalizeEOL || DEFAULT_OPTIONS.normalizeEOL,
            copyNewFiles: options.copyNewFiles || DEFAULT_OPTIONS.copyNewFiles,
            copyBinaryFiles: options.copyBinaryFiles || DEFAULT_OPTIONS.copyBinaryFiles,
            deleteMissingFiles: options.deleteMissingFiles || DEFAULT_OPTIONS.deleteMissingFiles,
            skipNodeModules: options.skipNodeModules || DEFAULT_OPTIONS.skipNodeModules
        },
        deletedFiles: []
    };

    let exclude = []
    if (patchInfo.options.skipNodeModules){
        exclude = ["**/node_modules/**/*"]
    }
    let originalFileList = glob.sync(["**/*"], { cwd: originalModuleDir, ignore: exclude});

    if (originalFileList.length === 0) {
        throw new Error(`Could not find any files in ${originalModuleDir}`);
    }

    let projectFilesList = glob.sync(["**/*", "!**/node_modules/**/*"], { cwd: modifiedModuleDir, ignore: exclude });
    files = concatUnique(originalFileList, projectFilesList);

    fs.removeSync(outputDir);
    fs.mkdirpSync(outputDir);
    files.forEach((file) => {
        createPatch(file, originalModuleDir, modifiedModuleDir, outputDir, patchInfo);
    });

    fs.writeFileSync(patchInfoPath, JSON.stringify(patchInfo, null, 2));
}

exports.createPatchesForModule = createPatchesForModule;
