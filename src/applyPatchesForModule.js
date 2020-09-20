const Diff = require('diff');
const fs = require("fs-extra");
const glob = require("fast-glob");
const { join, resolve, basename } = require('path');
const { ModulePatch } = require("./ModulePatch");
const { ModuleFile } = require('./ModuleFile');
const DEFAULT_OPTIONS = require('./defaultOptions');

/**
 * @param {string} patchPath
 * @param {string} modulePatchesDir
 * @param {string} originalModuleDir
 * @param {string} workspaceModuleDir
 */

 // TODO: actually care about the options
function applyPatch(patchPath, modulePatchesDir, originalModuleDir, workspaceModuleDir, options) {
    let patch = new ModulePatch(patchPath, modulePatchesDir, originalModuleDir, options);
    let newFilePath;
    if (!patch.exists){
        throw new Error("Patch does not exist!");
    }
    
    // not a patch, new file, just copy it over.
    if (!patch.isPatch) {
        newFilePath = join(workspaceModuleDir, patch.relativePath);
        fs.ensureFileSync(newFilePath);
        fs.copyFileSync(patch.absolutePath, newFilePath);
        return;
    }
    let fileToPatch = new ModuleFile(patch.fileInfo.relativePath, patch.originalModuleDir);
    let newFileData = Diff.applyPatch(fileToPatch.data, patch.data);
    newFilePath = join(workspaceModuleDir, patch.fileInfo.relativePath);
    if (newFileData === false) {
        console.log("Failed to apply patch to " + fileToPatch.relativePath);
        console.log("Not copying to new path " + newFilePath);
        console.log("Please patch and copy manually!");
        fs.removeSync(newFilePath);
        return;
    }
    fs.removeSync(newFilePath);
    if (newFileData.length !== 0) {
        fs.ensureFileSync(newFilePath);
        fs.writeFileSync(newFilePath, newFileData);
    }
}

/**
 * @param {string} originalModuleDir
 * @param {string} patchesDir
 * @param {string} outputModulesDir
 * @param {Object} [options]
 * @param {{ [key: string]: string | number } | string} [options.versionInfo]
 * @param {string}  [options.patchFormat] patch format, only supports unified right now
 * @param {string}  [options.normalizeEOL] either "LF" or "CRLF"
 * @param {boolean} [options.copyNewFiles] copies files in modifiedModuleDir into patch directory 
 * @param {boolean} [options.copyBinaryFiles] copies changed binary files in modfiedModuleDir into patch directory
 * @param {boolean} [options.deleteMissingFiles] deletes missing files in modifiedModuleDir
 * @param {boolean} [options.skipNodeModules] skips node_modules
 * @param {boolean} [options.failIfVersionsDiffer] Fail if versions differ.
 */

async function applyPatchesForModule(originalModuleDir, modulePatchesDir, outputModuleDir, options) {

    let patchesList = glob.sync(["**/*", "!**/node_modules/**/*"], { cwd: modulePatchesDir });

    let patchesInfoPath = join(resolve(modulePatchesDir,".."), basename(modulePatchesDir) + "-patch-info.json");
    let patches_info = {};
    if (fs.existsSync(patchesInfoPath)){
        patches_info = require(join(resolve(modulePatchesDir,".."), basename(modulePatchesDir) + "-patch-info.json"));
    }

    options = options || {};
    let versionInfo = options.versionInfo || null;
    let failIfVersionsDiffer = options.failIfVersionsDiffer || true;

    let patchOptions = patches_info.options || {};
    patchOptions.patchFormat = options.patchFormat || patchOptions.patchFormat || DEFAULT_OPTIONS.patchFormat;
    patchOptions.normalizeEOL = options.normalizeEOL || patchOptions.normalizeEOL || DEFAULT_OPTIONS.normalizeEOL;
    patchOptions.copyNewFiles = options.copyNewFiles || patchOptions.copyNewFiles || DEFAULT_OPTIONS.copyNewFiles;
    patchOptions.copyBinaryFiles = options.copyBinaryFiles || patchOptions.copyBinaryFiles || DEFAULT_OPTIONS.copyBinaryFiles;
    patchOptions.deleteMissingFiles = options.deleteMissingFiles || patchOptions.deleteMissingFiles || DEFAULT_OPTIONS.deleteMissingFiles;
    patchOptions.skipNodeModules = options.skipNodeModules || patchOptions.skipNodeModules || DEFAULT_OPTIONS.skipNodeModules;

    // TODO: don't do JSON.stringify
    if (patches_info.versionInfo && versionInfo && JSON.stringify(versionInfo) != JSON.stringify(patches_info.versionInfo)) {
        console.log("WARNING: Patch does not match version of file it is being applied to.\n");
        if (failIfVersionsDiffer){
            console.log("Refusing to patch differing versions");
            process.exit(1);
        } else {
            console.log("Attempting to patch anyway");
        }
    }

    if (fs.existsSync(outputModuleDir)) {
        fs.removeSync(outputModuleDir);
    }

    //copy over original files
    fs.copySync(originalModuleDir, outputModuleDir);
    if (patchOptions.skipNodeModules){
        //remove node_modules
        glob.sync(["**/node_modules"], { onlyDirectories: true, absolute: true, cwd: outputModuleDir }).forEach((dir) => {
            fs.removeSync(dir);
        });
    }
    
    if (patches_info && patchOptions.deleteMissingFiles)
    patches_info.deletedFiles.forEach((file) => {
        fs.removeSync(join(outputModuleDir, file));
    });

    patchesList.forEach(patchPath => applyPatch(patchPath, modulePatchesDir, originalModuleDir, outputModuleDir, patchOptions));
}
exports.applyPatchesForModule = applyPatchesForModule;
