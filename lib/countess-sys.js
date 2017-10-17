'use babel';

/******************************************************************************
* CounteSS System Module
*
* This module is the tie between the CounteSS Engine and the Atom buffer. It
* reads data from the editor buffer and pipes it to the engine to analyze. Once
* the analysis is complete, this module marks the appropriate line found in the
* buffer. It also serves as the control flow for errors that bubble up from the
* engine. By default, these errors are printed to the Atom console.
******************************************************************************/


export default class CounteSS {
  /*********************************************************************
  * Set up dependancies and tie in both the engine and the editor
  *********************************************************************/
  constructor () {
    this.editor = atom.workspace.getActiveTextEditor();
    this.engine = require("./countess-engine.js");
    this.markers = [];
  }

  /*********************************************************************
  * Suppose to return an object that can be retrieved when package is
  * activated, but right now it does not matter.
  *********************************************************************/
  serialize () {}

  /*********************************************************************
  * Run the engine on our editor's text, and mark the appropriate lines
  * on the screen when unused / overwritten CSS is used.
  *********************************************************************/
  analyze (callback) {
    var filename = this.editor.getPath();
    if (filename.substr(filename.length - 5) !== ".html") {
      return;
    }

    try {
      this.stats = this.engine.getStats(this.editor.getBuffer().getText());
      this.getUnusedLines().forEach((u) =>{
        this.markLine(u.index, "unused-css");
      });
      this.getOverwrittenLines().forEach((o) =>{
        this.markLine(o.index, "overwritten-css");
      });
      this.checkBufferForSyntaxErrors();
    } catch (e) {
      if (e.name === "SyntaxError") {
        console.info("Encountered a CSS syntax error on '"+e.selector+"'");
        this.checkBufferForSyntaxErrors(e.selector);
      } else {
        this.checkBufferForSyntaxErrors();
        console.error(e);
      }
      if (callback) {
        callback(e);
      }
    }

    if (callback) {
      callback(null, this.stats);
    }
  }

  /*********************************************************************
  * Remove all avtive markers from the screen.
  *********************************************************************/
  removeAnnotations () {
    this.markers.forEach(m => m.destroy());
    this.markers = [];
  }

  /*********************************************************************
  * use the stats object to parse the CSS looking for unused selectors
  *********************************************************************/
  getUnusedLines () {
    var lineCount = this.editor.getScreenLineCount();
    var statsByLine = [];
    var inStyles = false;
    for (var i = 0; i < lineCount; i++) {
      var line = this.editor.lineTextForScreenRow(i);
      if (line.includes("<style")) {
        inStyles = true;
      }
      if (line.includes("</style")) {
        inStyles = false;
        break;
      }
      if (inStyles) {
        var check = this._lineHasUnusedStats(line);
        if (check.doesHave) {
          statsByLine.push({
            index: i,
            line: line,
            stats: check.element,
            type: "UNUSED"
          });
        }
      }
    }
    return statsByLine;
  }

  /*********************************************************************
  * check if a line on the screen has CSS selectors that are unused
  *********************************************************************/
  _lineHasUnusedStats (line) {
    var doesHave = false;
    var it = null;
    this.stats.unused.forEach((u, i) => {
      if (line.includes(u.selector)) {
        doesHave = true;
        it = u;
      }
    });
    return { doesHave: doesHave, element: it };
  }

  /*********************************************************************
  * use the stats object to parse the CSS looking for overwritten properties
  *********************************************************************/
  getOverwrittenLines () {
    var currentSelectorLine = "";
    var insideSelector = false;
    var lineCount = this.editor.getScreenLineCount();
    var statsByLine = [];
    var inStyles = false;
    for (var i = 0; i < lineCount; i++) {
      var line = this.editor.lineTextForScreenRow(i);
      if (line.includes("<style")) {
        inStyles = true;
      }
      if (line.includes("</style")) {
        inStyles = false;
        break;
      }
      if (line.includes("{")) {
        currentSelectorLine += line;
        insideSelector = true;
      }
      if (line.includes("}")) {
        currentSelectorLine = "";
        insideSelector = false;
      }
      if (!insideSelector) {
        currentSelectorLine += line;
      }
      if (inStyles) {
        var check = this._lineHasOverwrittenStat(line, currentSelectorLine);
        if (check.doesHave) {
          statsByLine.push({
            index: i,
            line: line,
            stats: check.element,
            type: "OVERWRITTEN"
          });
        }
      }
    }
    return statsByLine;
  }

  /*********************************************************************
  * check if a line on the screen has CSS that gets overwritten later
  *********************************************************************/
  _lineHasOverwrittenStat (line, currentSelectorLine) {
    var doesHave = false;
    var it = null;
    var newStatsList = [];
    this.stats.overwritten.forEach((o, i) => {
      if (currentSelectorLine.includes(o.selector) && line.includes(o.property)) {
        doesHave = true;
        it = o;
      } else {
        newStatsList.push(o);
      }
    });
    this.stats.overwritten = newStatsList;
    return { doesHave: doesHave, element: it };
  }


  markLine (line, cssClass) {
    var range = this.editor.getBuffer().rangeForRow(line);
    var marker = this.editor.markBufferRange(range);
    this.markers.push(marker);
    this.editor.decorateMarker(marker, {
      type: 'line',
      class: cssClass
    });
  }

  checkBufferForSyntaxErrors (badSelector) {
    var lineCount = this.editor.getScreenLineCount();
    var currentSelectorLine = "";
    var inStyles       = false;
    var insideSelector = false;
    var insideComment  = false;

    for (var i = 0; i < lineCount; i++) {
      var line = this.editor.lineTextForScreenRow(i);
      if (line.includes("<style")) {
        inStyles = true;
      }
      if (line.includes("</style")) {
        inStyles = false;
        break;
      }

      if (line.includes("}")) {
        currentSelectorLine = "";
        insideSelector = false;
      }

      if (line.includes("/*")) {
        insideComment = true;
      }

      if (inStyles) {
        currentSelectorLine += line;
        if (insideSelector) {
          if (!insideComment &&
              line.trim().length > 0 &&
              !line.includes("{") &&
              !line.includes("@") &&
              !(/.+:.+;/).test(line)) {
            this.markLine(i, "syntax-error");
          }
        } else if (badSelector && currentSelectorLine.replace("{", "").replace("}", "").effectivelyEqual(badSelector)) {
          this.markLine(i, "syntax-error");
        }
      }

      if (line.includes("{")) {
        insideSelector = !line.includes("}");
      }

      if (line.includes("*/")) {
        insideComment = false;
      }
    }
  }
}
