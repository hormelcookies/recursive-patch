const Diff = require('diff');
const { basename, join, extname } = require("path");
const { ModuleFile } = require('./ModuleFile');

class ModulePatch extends ModuleFile {
    /**
     *Creates an instance of ModulePatch.
     * @param {string} relativePath relative path to patch
     * @param {string} modulePatchesDir absolute path to module patches dir
     * @param {string} originalModuleDir absolute path to original module dir
     * @param {Object} [options]
     * @param {string} [options.normalizeEOL]
     * @memberof ModulePatch
     */
    constructor(relativePath, modulePatchesDir, originalModuleDir, options) {
        super(relativePath, modulePatchesDir, options);
        this.modulePatchesDir = modulePatchesDir;
        this.originalModuleDir = originalModuleDir;
    }
    /**
     * @readonly
     * @memberof ModulePatch
     * @return {boolean}
     */
    get isPatch() {
        if (!this.exists){
            return false;
        } else if (extname(this.name) !== ".patch"){
            return false;
        }
        return true;
    }
    /**
     * Get the ParsedDiff
     * @readonly
     * @memberof ModulePatch
     * @return {Diff.ParsedDiff}
     */
    get parsed(){
        if (!this.exists){
            return null;
        } else if (!this._parsed){
            if (this.encoding !== "utf8"){
                throw new Error("Binary patches not supported yet")
            }
            this._parsed = Diff.parsePatch(this.data)[0];
        }
        return this._parsed;
    }
    /**
     * @readonly
     * @memberof ModulePatch
     * @return {{name: string, relativePath: string, absolutePath: string}}
     */
    get fileInfo(){
        if (!this.exists || !this.parsed){
            return null;
        } else if (!this._fileInfo){
            this._fileInfo = {};
            if (!this.parsed.index){
                this._fileInfo.relativePath = this.parsed.oldFileName;
            } else {
                this._fileInfo.relativePath = this.parsed.index;
            }
            this._fileInfo.name = basename(this._fileInfo.relativePath);
            this._fileInfo.absolutePath = join(this.originalModuleDir, this._fileInfo.relativePath);
        }
        return this._fileInfo;
    }
}



exports.ModulePatch = ModulePatch;
