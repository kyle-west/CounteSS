/******************************************************************************
* CounteSS Engine
*
* This module is written in the standard ES5 Node form, exporting only the
* portion of the engine we care about externally. The engine takes raw text and
* analyzes it, returning an object with data about selectors that are unused,
* and properties that are over written. Further, the file coerces Polymer
* elements to be interpreted as a single standard HTML page.
******************************************************************************/

/*********************************************************************
*  These are our dependancies that are needed thoughout the engine
*********************************************************************/
const { JSDOM } = require("jsdom"); // DOM parser
const $css      = require('css');   // CSS parser

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


/*********************************************************************
* Middleware that helps use inline parse text better.
*********************************************************************/
// Replaces all occurances in a string.
String.prototype.replaceAll = function (check, newBit) {
  return this.replace(new RegExp(check, 'g'), newBit);
};

// replace last occurance of a string within a string
String.prototype.replaceLast = function (check, newBit) {
  var i = this.lastIndexOf(check);
  return this.substring(0, i - check.length) + newBit + this.substring(i+check.length);
};

// pseudo elements do not return true in a query select, even if the element
// exists. This takes the pseudo elements out of the string.
String.prototype.removeAllPseudos = function (list) {
  var copy = this;
  pseudoElements.forEach((item) => {
    copy = copy.replaceAll(":"+item, ""); // incase double colon
    copy = copy.replaceAll(item, "");
  });
  return copy;
};

// returns true if two strings are the same reguarless of whitespace
String.prototype.effectivelyEqual = function (rhs) {
  return this.replace(/\s/g, '').replace("undefined", "") === rhs.replace(/\s/g, '');
};


/*********************************************************************
* This function takes the raw HTML and parses it into finding unused
* and overwritten css.
*********************************************************************/
function analyzer (html) {
  html = polymerCoercion(html);

  // parse the html into a dom object
  const parsed   = new JSDOM(html);
  if    (!parsed) { return { error: "ERROR: COULD NOT PARSE FILE", data: html }; }
  var   window   = parsed.window;
  var   document = window.document;
  if    (!document) { return { error: "ERROR: DOCUMENT OBJECT NOT FOUND", data: parsed }; }

  // holders for data
  var overwritten = [];
  var unused = [];

  // collect the CSS
  var style = document.querySelector("style") || document.body.querySelector("style");
  if (!style) { return { error: "ERROR: <STYLE> ELEMENT NOT FOUND", data: document}; }

  // parse the CSS
  var _css_ = $css.parse(style.innerHTML);

  // check where styles are overwritten or unused
  _css_.stylesheet.rules.forEach((rule, i) => {
    if (rule.type === 'rule') {
      rule.selectors.forEach((sel) => {
        try {
          // check for unused style rule
          var selector = sel.removeAllPseudos();
          if (!document.querySelector(selector)) {
            unused.push({ selector: sel });
          } else { // check for overwritten style properties
            for (var j = i+1; j < _css_.stylesheet.rules.length; j++) {
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
          }
        } catch (e) {
          e.selector = sel;
          throw e;
        }
      });
    } else if (rule.type === 'media') { // record media querie scoped items only one level deep
      rule.rules.forEach((mrule, mi) => {
        if (mrule.type === 'rule') {
          mrule.selectors.forEach((sel) => {
            try {
              // check for unused style rule
              var selector = sel.removeAllPseudos();
              if (!document.querySelector(selector)) {
                unused.push({selector: sel, media: rule.media });
              } else { // check for overwritten style properties
                for (var j = mi+1; j < rule.rules.length; j++) {
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
              }
            } catch (e) {
              e.selector = sel;
              throw e;
            }
          });
        }
      });
    }
  });

  return {overwritten: overwritten, unused: unused};
}


/*********************************************************************
* Force a Polymer Element to look like standard HTML for the parsers
*********************************************************************/
function polymerCoercion (polymer) {
  var html = polymer;

  // reconstruct the polmyer to a standard DOM
  html = html.replaceAll("dom-module", "html")
    .replace("<template", "<body")
    .replaceLast("</template", "</body")
    .replace(/^.*\@apply.*$/mg, "");

  // pre parse the HTML and remove undeed things
  html = html.match(/\S+/g);
  html.forEach((word, i) => {
    // replace host selectors
    if (word.includes(":host(")) {
      html[i] = html[i].replace(":host(", "html");
      html[i] = html[i].substring(0, html[i].length-1);
    } else if (word.includes(":host[")) {
      html[i] = "html";
    } else if (word.includes(":host")) {
      html[i] = html[i].replace(":host", "html");
    }

    var removeCount, j;

    // remove mixins
    if (word[0]==='-' && word[1]==='-') {
      removeCount = 1;
      j = i;
      if (html[i+1].includes("{")) {
        while (!html[++j].includes("}")) { removeCount++; }
      } else {
        while (!html[++j].includes(";")) { removeCount++; }
      }
      removeCount++;
      html.splice(i, removeCount);
    }

    // remove JS
    if (word.includes("<script")) {
      removeCount = 1;
      j = i;
      while (!html[++j].includes("</script")) { removeCount++; }
      removeCount++;
      html.splice(i, removeCount);
    }

    // remove html comments
    if (word.includes("<!--")) {
      removeCount = 1;
      j = i;
      while (!html[++j].includes("-->")) { removeCount++; }
      removeCount++;
      html.splice(i, removeCount);
    }
  });

  return html.join(" ");
}


/*********************************************************************
* Export out only the functions and properties we care about
*********************************************************************/
module.exports = {
  getStats: analyzer
};
