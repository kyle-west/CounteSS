var fs = require('fs');
const { JSDOM } = require("jsdom");
var $css = require('css');

var debug = true;
debug = false;


// list of valid pseudo-elements
const pseudoElements = [
  ':active',
  ':after',
  ':before',
  ':checked',
  ':disabled',
  ':empty',
  ':enabled',
  ':first-child',
  ':first-letter',
  ':first-line',
  ':first-of-type',
  ':focus',
  ':hover',
  ':in-range',
  ':invalid',
  ':lang(language)',
  ':last-child',
  ':last-of-type',
  ':link',
  ':not(selector)',
  ':nth-child(n)',
  ':nth-last-child(n)',
  ':nth-last-of-type(n)',
  ':nth-of-type(n)',
  ':only-of-type',
  ':only-child',
  ':optional',
  ':out-of-range',
  ':read-only',
  ':read-write',
  ':required',
  ':root',
  ':target',
  ':valid',
  ':visited'
];

// so we can replace all occurances in a string.
String.prototype.replaceAll = function(check, newBit) {
    return this.replace(new RegExp(check, 'g'), newBit);
};

// replace last occurance
String.prototype.replaceLast = function(check, newBit) {
    var i = this.lastIndexOf(check)
    return this.substring(0, i - check.length) + newBit + this.substring(i+check.length);
};

String.prototype.removeAllPseudos = function(list) {
  var copy = this;
  pseudoElements.forEach((item) => {
    copy = copy.replaceAll(":"+item,""); // incase double colon
    copy = copy.replaceAll(item,"");
  });
  return copy;
};

//
String.prototype.containsOneOf= function(list) {
  list.forEach((item) => {
    if (this.includes(item)) return true;
  });
  return false;
};


function checkCSS (filename, rawdata) {

  var html;
  if (filename) {
    // read the file contents
    html = fs.readFileSync(filename, 'utf8');
  } else {
    html = rawdata;
  }

  // coerce Polymer elements to to look like regular HTML to the parser
  html = html.replaceAll("dom-module","html")
    .replace("<template", "<body")
    .replaceLast("</template", "</body")
    .replace(/^.*\@apply.*$/mg, "");
  html = html.match(/\S+/g);
  html.forEach((word, i) => {

    // replace host selectors
    if (word.includes(":host(")) {
      html[i] = html[i].replace(":host(", "html");
      html[i] = html[i].substring(0,html[i].length-1);
    } else if (word.includes(":host[")) {
      html[i] = "html";
    } else if (word.includes(":host")) {
      html[i] = html[i].replace(":host", "html");
    }

    // remove mixins
    if (word[0]==='-' && word[1]==='-') {
      var removeCount = 1;
      var j = i;
      if (html[i+1].includes("{")) {
        while (!html[++j].includes("}")) removeCount++;
      } else {
        while (!html[++j].includes(";")) removeCount++;
      }
      removeCount++;
      html.splice(i,removeCount);
    }

    // remove JS
    if (word.includes("<script")) {
      var removeCount = 1;
      var j = i;
      while (!html[++j].includes("</script")) removeCount++;
      removeCount++;
      html.splice(i,removeCount);
    }

    // html comments
    if (word.includes("<!--")) {
      var removeCount = 1;
      var j = i;
      while (!html[++j].includes("-->")) removeCount++;
      removeCount++;
      html.splice(i,removeCount);
    }

  });
  html = html.join(" ");

  // parse the html into a dom object
  const parsed   = new JSDOM(html);
  if (!parsed) return { error:"ERROR: COULD NOT PARSE FILE", data: html };
  var   window   = parsed.window;
  var   document = window.document;
  if (!document) return { error:"ERROR: DOCUMENT OBJECT NOT FOUND", data: parsed };
  // holders for data
  var overwritten = [];
  var unused = [];


  // collect the CSS
  var style = document.querySelector("style") || document.body.querySelector("style");
  if (!style) return { error:"ERROR: <STYLE> ELEMENT NOT FOUND", data: document};

  // parse the CSS
  var _css_ = $css.parse(style.innerHTML);

  // check where styles are overwritten or unused
  _css_.stylesheet.rules.forEach((rule, i) => {
    if (rule.type === 'rule') {
      rule.selectors.forEach((sel) => {
        // check for unused style rule
        var selector = sel.removeAllPseudos();
        if (!document.querySelector(selector)) {
          unused.push({ selector: sel });
        }
        // check for overwritten style properties
        else for (var j = i+1; j < _css_.stylesheet.rules.length; j++) {
          if (_css_.stylesheet.rules[j].type === 'rule' && _css_.stylesheet.rules[j].selectors.includes(sel)) {
            rule.declarations.forEach((dec1) => {
              _css_.stylesheet.rules[j].declarations.forEach((dec2) => {
                if (dec1.property === dec2.property && !dec1.value.includes("!important")) {
                  overwritten.push({ property: dec1.property, selector: sel });
                }
              });
            });
          }
        }
      });
    } else if (rule.type === 'media') {
      rule.rules.forEach((mrule, mi) => {
        if (mrule.type === 'rule') {
          mrule.selectors.forEach((sel) => {
            // check for unused style rule
            var selector = sel.removeAllPseudos();
            if (!document.querySelector(selector)) {
              unused.push({selector: sel, media: rule.media });
            }
            // check for overwritten style properties
            else for (var j = mi+1; j < rule.rules.length; j++) {
              if (rule.rules[j].type === 'rule' && rule.rules[j].selectors.includes(sel)) {
                mrule.declarations.forEach((dec1) => {
                  rule.rules[j].declarations.forEach((dec2) => {
                    if (dec1.property === dec2.property && !dec1.value.includes("!important")) {
                      overwritten.push({ property: dec1.property, selector: sel, media: rule.media });
                    }
                  });
                });
              }
            }
          });
        }
      });
    }
  });

  return {overwritten: overwritten, unused:unused};
}

module.exports = {
  getStats: checkCSS
}
