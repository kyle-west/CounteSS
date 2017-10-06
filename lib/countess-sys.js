'use babel';

export default class CounteSS {

  constructor() {
    this.editor = atom.workspace.getActiveTextEditor();
    this.engine = require("./countess-engine.js");
    this.markers = [];
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  analyze() {
    var filename = this.editor.getPath();
    if (filename.substr(filename.length - 5) !== ".html") return;

    try {
      this.stats = this.engine.getStats(null, this.editor.getBuffer().getText());
      this.getUnusedLines().forEach((u) =>{
        var range = this.editor.getBuffer().rangeForRow(u.index);
        var marker = this.editor.markBufferRange(range);
        this.markers.push(marker);
        this.editor.decorateMarker(marker, {
          type: 'line',
          class: "unused-css"
        });
      });
      this.getOverwrittenLines().forEach((o) =>{
        var range = this.editor.getBuffer().rangeForRow(o.index);
        var marker = this.editor.markBufferRange(range);
        this.markers.push(marker);
        this.editor.decorateMarker(marker, {
          type: 'line',
          class: "overwritten-css"
        });
      });
    } catch (e) {
      if (e.name === "SyntaxError") {
        console.info("Encountered a CSS syntax error.");
      } else {
        console.error(e);
      }
    }
  }

  removeAnnotations() {
    this.markers.forEach(m => m.destroy());
    this.markers = [];
  }

  getUnusedLines() {
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
          statsByLine.push({index:i, line:line, stats:check.element, type: "UNUSED"});
        }
      }
    }
    return statsByLine;
  }

  _lineHasUnusedStats(line) {
    var doesHave = false;
    var it = null;
    this.stats.unused.forEach((u,i) => {
      if (line.includes(u.selector)) {
        doesHave = true;
        it = u;
      }
    });
    return { doesHave:doesHave, element:it };
  }

  getOverwrittenLines() {
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
          statsByLine.push({index:i, line:line, stats:check.element, type: "OVERWRITTEN"});
        }
      }
    }
    return statsByLine;
  }

  _lineHasOverwrittenStat(line, currentSelectorLine) {
    var doesHave = false;
    var it = null;
    var newStatsList = [];
    this.stats.overwritten.forEach((o,i) => {
      if (currentSelectorLine.includes(o.selector) && line.includes(o.property)) {
        doesHave = true;
        it = o;
      } else {
        newStatsList.push(o);
      }
    });
    this.stats.overwritten = newStatsList;
    return { doesHave:doesHave, element:it };
  }

}
