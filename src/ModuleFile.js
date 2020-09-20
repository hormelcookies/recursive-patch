const fs = require("fs-extra");
const { isBinary } = require("istextorbinary");
const { join, basename } = require("path");
const endOfLine = require('eol');

/**
 *
 *
 * @class ModuleFile
 */
class ModuleFile {

    /**
     *Creates an instance of ModuleFile.
     * @param {string} relativePath path relative to the module directory
     * @param {string} moduleDir absolute path to the module directory
     * @param {Object} [options]
     * @param {string} [options.normalizeEOL]
     * @memberof ModuleFile
     */
    constructor(relativePath, moduleDir, options){
        this.name = basename(relativePath)
        this.moduleDir = moduleDir;
        this.relativePath = relativePath;
        this.absolutePath = join(moduleDir, relativePath);
        this.normalizeEOL = options ? options.normalizeEOL : undefined;
    }

    /**
     * @readonly
     * @memberof ModuleFile
     */
    get exists (){
        // If this file doesn't exist yet, it'll check every time
        if (!this._exists){
            this._exists = fs.existsSync(this.absolutePath);
        }
        return this._exists;
    }

     /**
     * @readonly
     * @memberof ModuleFile
     */
    get encoding (){
        if (!this.exists){
            return null;
        } else if (!this._encoding){
            this._encoding = isBinary(this.absolutePath) ? "binary" : "utf8"
        }
        return this._encoding;
    }

    /**
     * string | Buffer
     * @readonly 
     * @memberof ModuleFile
     */
    get data (){
        if (!this.exists){
            return null;
        } else if (!this._data){
            if (this.encoding === "utf8"){
                this._data = fs.readFileSync(this.absolutePath, {encoding:"utf8"})
                if (this.normalizeEOL){
                    this._data = endOfLine.lf(this._data);
                }
            } else {
                this._data = fs.readFileSync(this.absolutePath);
            }
        }
        return this._data;
    }
}

exports.ModuleFile = ModuleFile;
