// libraries: jquery, lunr, lodash
// arguments: $, lunr, _

$(document).ready(function () {
  // parseUri 1.2.2
  // (c) Steven Levithan <stevenlevithan.com>
  // MIT License
  function parseUri(str) {
    var o = parseUri.options,
      m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
      uri = {},
      i = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
      if ($1) uri[o.q.name][$1] = $2;
    });

    return uri;
  }
  parseUri.options = {
    strictMode: false,
    key: [
      "source",
      "protocol",
      "authority",
      "userInfo",
      "user",
      "password",
      "host",
      "port",
      "relative",
      "path",
      "directory",
      "file",
      "query",
      "anchor",
    ],
    q: {
      name: "queryKey",
      parser: /(?:^|&)([^&=]*)=?([^&]*)/g,
    },
    parser: {
      strict:
        /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
      loose:
        /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
    },
  };

  $("#search-form").submit(function (e) {
    e.preventDefault();
  });

  // list below is the lunr 2.1.3 list minus the intersect with names(Base)
  // (all, any, get, in, is, only, which) and (do, else, for, let, where, while, with)
  // ideally we'd just filter the original list but it's not available as a variable
  lunr.stopWordFilter = lunr.generateStopWordFilter([
    "a",
    "able",
    "about",
    "across",
    "after",
    "almost",
    "also",
    "am",
    "among",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "because",
    "been",
    "but",
    "by",
    "can",
    "cannot",
    "could",
    "dear",
    "did",
    "does",
    "either",
    "ever",
    "every",
    "from",
    "got",
    "had",
    "has",
    "have",
    "he",
    "her",
    "hers",
    "him",
    "his",
    "how",
    "however",
    "i",
    "if",
    "into",
    "it",
    "its",
    "just",
    "least",
    "like",
    "likely",
    "may",
    "me",
    "might",
    "most",
    "must",
    "my",
    "neither",
    "no",
    "nor",
    "not",
    "of",
    "off",
    "often",
    "on",
    "or",
    "other",
    "our",
    "own",
    "rather",
    "said",
    "say",
    "says",
    "she",
    "should",
    "since",
    "so",
    "some",
    "than",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "tis",
    "to",
    "too",
    "twas",
    "us",
    "wants",
    "was",
    "we",
    "were",
    "what",
    "when",
    "who",
    "whom",
    "why",
    "will",
    "would",
    "yet",
    "you",
    "your",
  ]);

  // add . as a separator, because otherwise "title": "Documenter.Anchors.add!"
  // would not find anything if searching for "add!", only for the entire qualification
  lunr.tokenizer.separator = /[\s\-\.]+/;

  // custom trimmer that doesn't strip @ and !, which are used in julia macro and function names
  lunr.trimmer = function (token) {
    return token.update(function (s) {
      return s.replace(/^[^a-zA-Z0-9@!]+/, "").replace(/[^a-zA-Z0-9@!]+$/, "");
    });
  };

  lunr.Pipeline.registerFunction(lunr.stopWordFilter, "juliaStopWordFilter");
  lunr.Pipeline.registerFunction(lunr.trimmer, "juliaTrimmer");

  var index = lunr(function () {
    this.ref("location");
    this.field("title", { boost: 100 });
    this.field("text");
    documenterSearchIndex["docs"].forEach(function (e) {
      this.add(e);
    }, this);
  });
  var store = {};

  documenterSearchIndex["docs"].forEach(function (e) {
    store[e.location] = { title: e.title, category: e.category, page: e.page };
  });

  $(function () {
    searchresults = $("#documenter-search-results");
    searchinfo = $("#documenter-search-info");
    searchbox = $("#documenter-search-query");
    searchform = $(".docs-search");
    sidebar = $(".docs-sidebar");
    function update_search(querystring) {
      tokens = lunr.tokenizer(querystring);
      results = index.query(function (q) {
        tokens.forEach(function (t) {
          q.term(t.toString(), {
            fields: ["title"],
            boost: 100,
            usePipeline: true,
            editDistance: 0,
            wildcard: lunr.Query.wildcard.NONE,
          });
          q.term(t.toString(), {
            fields: ["title"],
            boost: 10,
            usePipeline: true,
            editDistance: 2,
            wildcard: lunr.Query.wildcard.NONE,
          });
          q.term(t.toString(), {
            fields: ["text"],
            boost: 1,
            usePipeline: true,
            editDistance: 0,
            wildcard: lunr.Query.wildcard.NONE,
          });
        });
      });
      searchinfo.text("Number of results: " + results.length);
      searchresults.empty();
      results.forEach(function (result) {
        data = store[result.ref];
        link = $('<a class="docs-label">' + data.title + "</a>");
        link.attr("href", documenterBaseURL + "/" + result.ref);
        if (data.category != "page") {
          cat = $(
            '<span class="docs-category">(' +
              data.category +
              ", " +
              data.page +
              ")</span>"
          );
        } else {
          cat = $('<span class="docs-category">(' + data.category + ")</span>");
        }
        li = $("<li>").append(link).append(" ").append(cat);
        searchresults.append(li);
      });
    }

    function update_search_box() {
      querystring = searchbox.val();
      update_search(querystring);
    }

    searchbox.keyup(_.debounce(update_search_box, 250));
    searchbox.change(update_search_box);

    // Disable enter-key form submission for the searchbox on the search page
    // and just re-run search rather than refresh the whole page.
    searchform.keypress(function (event) {
      if (event.which == "13") {
        if (sidebar.hasClass("visible")) {
          sidebar.removeClass("visible");
        }
        update_search_box();
        event.preventDefault();
      }
    });

    search_query_uri = parseUri(window.location).queryKey["q"];
    if (search_query_uri !== undefined) {
      search_query = decodeURIComponent(search_query_uri.replace(/\+/g, "%20"));
      searchbox.val(search_query);
    }
    update_search_box();
  });
});
