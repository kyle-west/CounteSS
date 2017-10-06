'use babel';

export default class CountessView {

  constructor(serializedState) {
    this.editor = atom.workspace.getActiveTextEditor();
    this.editorView = atom.views.getView(this.editor);
    this.encoder = require('htmlencode');

    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('countess');

    // collect stats for the page
    var filename = this.editor.getPath();
    var msg, analysis;

    if (filename.substr(filename.length - 5) === ".html") {
      const CounteSS = require("./countess-engine.js");
      this.stats = CounteSS.getStats(null, this.editor.getText());
      msg = this.process_byLine();
      analysis = this.getUnusedLines();
    } else {
      msg = filename + " is not an HTML document";
    }

    var markers = [];

    analysis.forEach((u) =>{
      var range = this.editor.getBuffer().rangeForRow(u.index);
      var marker = this.editor.markBufferRange(range);
      markers.push(marker);
      this.editor.decorateMarker(marker, {
        type: 'line',
        class: "unused-css"
      });

    });

    // Create message element
    const message = document.createElement('div');
    // message.innerText = msg;
    message.innerHTML = msg;
    message.classList.add('message');
    this.element.appendChild(message);
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  getElement() {
    return this.element;
  }

  p (data) {
    return "<p>"+data+"</p>";
  }

  process_menu () {
    var msg = "<h1>RESULTS:</h1><hr/>";
    if (this.stats.error) {
      msg += this.p(this.stats.error);
      msg += this.p(JSON.stringify(this.stats.data));
    } else {
      this.stats.unused.forEach((u) => {
        if (u.media) {
          msg += this.p("[  UNUSED   ] ==> @media "+u.media+" selector: '"+u.selector+"'");
        } else {
          msg += this.p("[  UNUSED   ] ==> selector: '"+u.selector+"'");
        }
      });

      this.stats.overwritten.forEach((o) => {
        if (o.media) {
          msg += this.p("[OVERWRITTEN] ==> @media "+o.media+" selector: '"+o.selector+"', property: '"+o.property+"'");
        } else {
          msg += this.p("[OVERWRITTEN] ==> selector: '"+o.selector+"', property: '"+o.property+"'");
        }
      });
    }
    return msg;
  }

  process_byLine() {
    var lineCount = this.editor.getScreenLineCount();
    var msg = "";
    var issueCount = 0;
    var inStyles = false;
    for (var i = 0; i < lineCount; i++) {
      var line = this.editor.lineTextForScreenRow(i);
      if (line.includes("<style")) {
        inStyles = true;
      }
      if (line.includes("</style")) {
        inStyles = false;
      }
      if (inStyles) {
        var check = this.lineHasUnusedStats(line);
        if (check.doesHave) {
          msg += this.p((i+1) + ": " + this.encoder.htmlEncode(line));
          issueCount++;
        }
      }
    }

    return "<h1>RESULTS: "+issueCount+"</h1><hr/>" + msg;
  }

  lineHasUnusedStats(line) {
    var doesHave = false;
    var it = null;
    var len = this.stats.unused.length;
    for (var i = 0; i < len; i++) {
      if (line.includes(u.selector)) {
        doesHave = true;
        it = u;
        break;
      }
    }
    return { doesHave:doesHave, element:it };
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
      }
      if (inStyles) {
        var check = this.lineHasUnusedStats(line);
        if (check.doesHave) {
          statsByLine.push({index:i, line:line, stats:check.element, type: "UNUSED"});
        }
      }
    }
    return statsByLine;
  }

}
