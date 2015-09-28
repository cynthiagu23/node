/**
 *  TODO Stuff
 * Cleaner merge of embeddable cached objects to minimize stale data
 * Memory tests
 * Lazy load json2?
 */

 /**
  * @fileOverview
  * Implementation for the fs library for use in conjuction with the fizzy server. Most code
  * examples given are how fizzy server utilizes the API directly.
  *
  * @author <a href="mailto:jbernardo@linkedin.com">John Bernardo</a>
  * @version $Id_
  */

/**
 * The global namespace for accessing fizzy methods and other properties. Currently, most of these
 * methods are used only by the fizzy server exclusively and seldom invoked directly from other
 * client JS code.
 * @namespace
 * @global
 */
window.fs = window.fs || {};

/**
 * @private
 * @define {string}
 */
var FS_VERSION = '0.0.0';

(function(fs, document, lab) {
  /*global dust */

  "use strict";

  /**
   * Constants
   */
   var FS_START_TS = +new Date(),

       VER = FS_VERSION,

       JS_TYPE = 'text/javascript',

       DIV = 'div',

       STR_TYPE = typeof(''),

       FN_TYPE = typeof(function(){}),

       EQ = '=', Q = '?', AMP = '&',

       NOOP = function(){},

       /**
        * An optional query parameter one can provide to the current URL which turns on debug
        * mode for the library. Messages get logged out to the browser console. If a browser
        * console is not available then the messages are surfaced in alert dialogs.
        *
        * @example
        * http://www.mysite.com/stuff?fzDebug
        *
        * @name ?fzDebug
        */
       DBG_PARAM = 'fzDebug',

       IS_IE = window.navigator.appName === 'Microsoft Internet Explorer',

       SCRIPT_TYPE_RXP = /(text|application)\/(java|ecma)script/i,

       SCRIPT_TAG = document.createElement('script').nodeName.toLowerCase(),

       CONTENT_SUFFIX = '-content',

       ESC_FLAGS = 'gi',

       TL_KEYS_HDR = 'X-FS-Template-Keys',

       TL_HDR = 'X-FS-TL',

       CONTENT_TYPE_HDR = 'Content-Type',

       BATCH_STATUS_HDR = 'X-FS-Batch-Status',

       EMBED_ERROR_HDR = 'X-FS-Embed-Error',

       LATE_KEY = '__late__',

       GLOBAL_EMBED_ID = '__*__',

       OBJECT_STR = {} + '',

       DEFAULT_CONFIG = {
         xhrHeaders: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-FS-Embed-Fetch': 1
         },

         failureRedirect: ''
       },

       EMBED_TYPE = {
         json: 'json', html: 'html', dupe: 'dupe'
       },

       RENDER_CONTROL = {
         custom: 'custom', server: 'server', immediate: 'immediate'
       },

       ERR_CODES = {
         payloadCacheMiss: 601,
         emptyPayloadNode: 602,
         dustRender: 603,
         dustChunk: 604,
         missingTemplate: 605,
         fizzyRender: 606,
         xhrStatus: 607,
         xhrContentType: 608,
         jsonParse: 609
       },

       GLOBAL_EVENTS = { error: 1 },

       EVENTS = {
         after: 'after', before: 'before', custom: 'custom', error: 'error',
         xhr: 'xhr', xhrCustom: 'xhrCustom'
       },

       EVENT_GROUPS = ['events', 'newEvents'],

       CALLBACK_GROUPS = ['listeners', 'called'],

       // Embed timings
       TIME_FIELDS = {
         // Retrieving the payload from the DOM (or cache) and unescaping it
         PARSE_PROCESS: 'parseProcessing',

         // JSON.parse()
         PARSE: 'parse',

         // Constructing the DocumentFragment for the embed, processing any script tags inside of
         // it by queueing them up for execution or asynchronous retrieval
         RENDER_PROCESS: 'renderProcessing',

         // dust.render()
         RENDER: 'render',

         // Asynchronous retrieval and execution of all external scripts within the embed and
         // execution of any inline scripts that appear after the external scripts
         SCRIPT_EXT_EVAL: 'scriptExternalEval',

         // Script execution of all inline scripts within the embed that appear before any
         // external scripts
         SCRIPT_INL_EVAL: 'scriptInlineEval',

      // The time needed to process the after queue
      AFTER_QUEUE_PROCESS: 'afterQueueProcessing',

      // The time needed to process the before queue
      BEFORE_QUEUE_PROCESS: 'beforeQueueProcessing',

         // Total time elapsed by all fields
         TOTAL: 'total'
       },

       // These entity definitions represent those characters which are escaped in HTML embed
       // content. Previously, we would escape both JSON and HTML content the same way. Although
       // we use an escape in JSON that works with the javascript parser (\\u unicode code points)
       // without needing unescaping for strings, negative numbers still require us to manually
       // unescape our \u002d back into -. Since we are not escaping \, this means user content
       // containing the string "\u002d" will contain -, and there is no way to drive the literal
       // string \u002d into user content in JSON. For HTML, we do something almost identical to
       // what was done previously, save for the escape for - (dash) is itself a valid entity -
       // &#45; instead of &dsh;
       HTML_ENTITY = {
         dsh: {
           escaped: '&dsh;', unescaped: '-',
           escapedInHtml: '&#45;', escapedInJson: '\\\\u002d', escapeToUseInJson: '\\u002d'
         },
         amp: {
           escaped: '&amp;', unescaped: '&',
           escapedInHtml: '&amp;', escapedInJson: '', escapeToUseInJson: ''
         }
       };

  /**
   * Global configuration, initialized with defaults and can be overriden with fs.config()
   */
  var globalConfig = DEFAULT_CONFIG;

  /**
   * Prototype functions
   */
  var _push = Array.prototype.push,
      _slice = Array.prototype.slice,
      _splice = Array.prototype.splice;

  /**
   * JsonEmbeds queued for rendering
   */
  var embeddables = {};

  /**
   * Resource pool of XHR objects for reuse
   */
  var xhrPool = [];

  /**
   * List of JavaScript source files to fetch
   */
  var jsToFetch = [];

  /**
   * Mapping of IDs which are dupes awaiting an XHR response
   */
  var dupeXHRQueue = {};

  /**
   * Method which will be used to create XMLHttpRequest (or ActiveX) objects, which is lazily
   * instantiated
   */
  var getXHR;

  /**
   * Internal timer mapping which stores timing information for embeds
   */
  var internalTime = {};

  /**
   * Global eval method as a cross-browser solution
   */
  var _eval = function(s) {
    (window.execScript || function(data) {
      window['eval'].call(window, data);
    })(s);
  };

  /**
   * Override the console if it doesn't exist
   */
  var console = (window.jstestdriver ? window.jstestdriver.console : window.console) || {
    warn: function() {
      var args = _slice.call(arguments, 0);
      window.alert(args.join(' '));
    }
  };

  /**
   * Flag indicating whether or not to operate in debug mode
   */
  var IS_DBG = isDebug(window.location.search);

  /**
   * Log mechanism that wraps the console and logs conditionally if debug is enabled or not.
   */
  var log = {
    warn: function() {
      if (!IS_DBG || !window.FZ_DBG) return;
      console.warn.apply(console, arguments);
    }
  };

  /**
   * Server namespace for use by fizzyserver only.
   */
  var server = {};

  // Clean up global namespace
  window.FS_VERSION = undefined;

  // Need to wrap try catch due to IE retardedness
  try {
    delete window.FS_VERSION;
  } catch (e) {
    // No-op
  }

  /**
   * Retrieve Fizzy's beginning timestamp
   */
  fs.startTS = function() {
    return FS_START_TS;
  };

  /**
   * Toggle Debug mode
   *
   * @param {Boolean} isDebug
   */
  fs.debug = function(isDebug) {
    IS_DBG = !!isDebug;
  };

  /**
   * Get the template path for a given embed ID
   *
   * @param {String} id
   * @return {String} templateId
   */
  fs.templateIdFor = function(id) {
    return embeddables[id] ? embeddables[id].templateId : '';
  };

  /**
   * Configure the client with various constants required to run.
   *
   * @param {Object} [params]
   *    parameters to configure the client with.
   *
   * @return {Object}
   *    the global configuration object.
   */
  fs.config = function config(params) {
    if (params) {
      merge(globalConfig, params, true, true);
    }

    return clone(globalConfig, true);
  };

  /**
   * Register a callback to receive timing data for an embed with the given ID. This method must
   * be invoked before the content is actually embedded into the DOM, otherwise the timings will
   * not be available.
   *
   * @param {String} id
   *    the ID of the embed which is specified in the 'fs-id' attribute.
   *
   * @param {Function} callback
   *    the callback which receives the timing data object.
   *
   * @since v1.1.2
   */
  fs.timing = function timing(id, callback) {
    var result = initEmbed(id, {id: id, recordTimings: true}, Embeddable),
        embed = result.embed;

    if ((!result.modified && !embed.timings) || !callback) {
      embed.recordTimings();
    }

    // If the event has already been finished previously
    if (callback) {
    if (embed.timingComplete) {
      callback(embed.timings);
    } else {
      embed.timingCallback = callback;
    }
    }
  };

  /**
   * Indicates whether we are using unicode character points to escape special chars
   */
  fs.isUniEscapeOn = function isUniEscapeOn() {
    return !!globalConfig.uniEscape;
  };

  /**
   * Set whether we are using unicode character points to escape special chars
   * Note: pass in undefined if you want to unset the value.
   */
  fs.setUniEscape = function setUniEscape(uniEscape) {
    globalConfig.uniEscape = uniEscape;
  };

  /**
   * Unescapes various special characters to their equivalent HTML entities within the given
   * string. Does not unescape other HTML entities such as the quote, since that's not necessary
   * to make fizzy work at this time. Previously, the only values unescaped were
   * '&amp;dsh;' which is '-' and '&amp;amp;' which is just '&amp;'.
   * Now, for HTML content, we substitute in &amp;#45; for - (dash) and &amp;amp; for &amp; (ampersand).
   * For JSON content, we substitute in \u002d for -
   *
   * @code
   * <script>
       // old way
   *   var s = '&lt;div&gt;1.21 &dsh; Jiggawatts &amp; Stuff&lt;/div&gt;';
   *   fs.unescape(s); // &lt;div&gt;1.21 - Jiggawatts &amp; Stuff&lt;/div&gt;
   *   // new way
   *   var s2 = '&lt;div&gt;1.21 &#45; Terawatts &amp; Stuff&lt;/div&gt;';
   *   fs.unescape(s2); // &lt;div&gt;1.21 - Terawatts &amp; Stuff&lt;/div&gt;
   * </script>
   *
   * @param {String} str
   *    the string to escape.
   *
   * @param {String} asJson
   *    whether or not the incoming string is expected to be json.
   *
   * @return {String}
   *    the escaped string.
   *
   */
  fs.unescape = function _unescape(str, asJson) {
    if( !fs.isUniEscapeOn() ) {
      return str.replace(new RegExp(HTML_ENTITY.dsh.escaped, ESC_FLAGS), HTML_ENTITY.dsh.unescaped)
                .replace(new RegExp(HTML_ENTITY.amp.escaped, ESC_FLAGS), HTML_ENTITY.amp.unescaped);
    } else {
      if( !asJson ) {
        return str.replace(new RegExp(HTML_ENTITY.dsh.escapedInHtml, ESC_FLAGS), HTML_ENTITY.dsh.unescaped)
                  .replace(new RegExp(HTML_ENTITY.amp.escapedInHtml, ESC_FLAGS), HTML_ENTITY.amp.unescaped);
      } else {
        return str.replace(new RegExp(HTML_ENTITY.dsh.escapedInJson, ESC_FLAGS), HTML_ENTITY.dsh.unescaped);
      }
    }
  };

  /**
   * Escapes characters to their equivalent HTML entities within the given string. Does not escape
   * other HTML entities such as the quote, since that's not necessary to make fizzy work at this
   * time. Currently, the only values escaped are '-' which is '&amp;#45;' and '&amp;' which is
   * '&amp;amp;'.
   *
   * @code
   * <script>
   *   var s = '<div>1.21 - Jiggawatts & Stuff</div>';
   *   fs.escape(s); // <div>1.21 &#45; Jiggawatts &amp; Stuff</div>
   * </script>
   *
   * @param {String} str
   *    the string to escape.
   *
   * @param {String} asJson
   *    whether or not the incoming string is expected to be json.
   *
   * @return {String}
   *    the escaped string.
   */
  fs.escape = function _escape(str, asJson) {
    if( !fs.isUniEscapeOn() ) {
      return str.replace(new RegExp(HTML_ENTITY.amp.unescaped, ESC_FLAGS), HTML_ENTITY.amp.escaped)
                .replace(new RegExp(HTML_ENTITY.dsh.unescaped, ESC_FLAGS), HTML_ENTITY.dsh.escaped);
    } else {
      if( !asJson ) {
        return str.replace(new RegExp(HTML_ENTITY.amp.unescaped, ESC_FLAGS), HTML_ENTITY.amp.escapedInHtml)
                  .replace(new RegExp(HTML_ENTITY.dsh.unescaped, ESC_FLAGS), HTML_ENTITY.dsh.escapedInHtml);
      } else {
        return str.replace(new RegExp(HTML_ENTITY.dsh.unescaped, ESC_FLAGS), HTML_ENTITY.dsh.escapeToUseInJson);
      }
    }
  };

  /**
   * Embed an already-used JSON payload into the given {@c templateId}. This {@c templateId} is
   * typically different from the original {@c templateId} which was used with the JSON
   * originally. The primary difference between using this method and the {@link fs.embed} method
   * directly is that a call to {@link fs.dupe} prevents a subsequent fetch to the same data
   * source that a previous embed has already used.
   *
   * @code
   * <script type='fs/embed' fs-id='mcfly' fs-uri='http://www.restful.com/api'></script>
   * <script>
   *   fs.embed('mcfly', 'mcfly-template'); // Uses JSON from www.restful.com/api to render
   * </script>
   * <script type='fs/embed' fs-id='biff' fs-uri='http://www.restful.com/api'></script>
   * <script>
   *   fs.dupe('biff', 'mcfly', 'biff-template'); // Also uses JSON from www.restful.com/api
   * </script>
   *
   * @param {String} id
   *    the reference ID of the embed to render.
   *
   * @param {String} dupeId
   *    the reference ID of the embed that originally used the JSON payload.
   *
   * @param {String} templateId
   *    the identifier for the template in the dust cache. This is synonymous to the
   *    {@c "fs-alias"} attribute.
   *
   * @param {String} [container]
   *    the ID of the DOM element which this embed will be inserted into. If no ID is given then
   *    the embed will be inserted before the reference element point with the ID provided by
   *    {@c id}.
   *
   */
  fs.dupe = function dupe(id, dupeId, templateId, container) {
    var payload = getContent(dupeId, true);

    // Grab the payload from the cache if it's not passed in
    if (!payload) {
      // Payload was not already cached so return early
      log.warn('No cached embed data located for template \'', templateId,
               '\' and reference ID \'', id,
               '\', the embed dependency with reference ID \'', dupeId,
               '\' may not have rendered correctly due to invalid or missing data');
      return;
    }

    // Check if the dupe embed was not already in the cache
    if (!embeddables[dupeId]) {
      // Create it and cache it
      embeddables[dupeId] = new JsonEmbed({ id: dupeId, context: payload });
    } else {
      embeddables[dupeId].context = payload;
    }

    return fs.embed(id, templateId, payload, container);
  };

  /**
   * Embed JSON payload into the given {@c templateId} where {@c dust.cache[templateId]} is not
   * {@c undefined}. The JSON used to render this embed will be retrieved from the {@c innerHTML}
   * of a DOM element with the ID '{fs-id}-content' which also must be entity-escaped
   * (just '&amp;' and '-' characters) and wrapped in a standard SGML comment. The creation of
   * this element is handled by the fizzy server after it receives a response from the embed. If
   * the content element can't be found then fz's cache will be searched, which may provide the
   * JSON if this embed has previously been rendered. If data can't be found in both the cache
   * and the DOM then the render will fail.
   *
   * @code
   * <script src='http://code.google.com/assets/templates/main.js'></script>
   * <script type='fs/embed' fs-id='mcfly' fs-uri='http://www.time-travel.com'></script>
   * <script>
   *   fs.embed('mcfly', 'main'); // Rendered with data from the code block above
   * </script>
   *
   * @param {String} id
   *    the reference ID of the embed to render.
   *
   * @param {String} templateId
   *    the identifier for the template in the dust cache. This is synonymous to the
   *    {@c "fs-alias"} attribute.
   *
   * @param {Object} [payload]
   *    the optional JSON literal payload. If this argument is {@c undefined}, fz will attempt to
   *    locate the JSON data first within the DOM then it's own payload cache.
   *
   * @param {String} [container]
   *    the ID of the DOM element which this embed will be inserted into. If no ID is given then
   *    the embed will be inserted before the reference element point with the ID provided by
   *    {@c id}.
   *
   * @throws {SyntaxError} there is an attempt to parse a malformed {@c payload}.
   * @throws {Error} an error occurs during the {@c dust.render} call.
   */
  fs.embed = function embed(id, templateId, payload, container) {
    var jsonEmbed, error;

    // Start timing for this embed
    timerStart(id);

    // No JSON payload means we need to look to our secondary sources (DOM, cache) for the data
    if (!payload) {
      // Check the DOM first, since the presence of data available there indicates freshness
      payload = getContent(id, true);

      // No content container element for the given id or it was empty (no data)
      if (!payload) {
        return;
      }
    }

    // Payload provided, create a new JSONEmbed object
    jsonEmbed = embeddables[id];

    // Check if this embed was not in the cache
    if (!jsonEmbed) {
      // Cache it and instantiate the embed
      embeddables[id] = jsonEmbed = new JsonEmbed({
        id: id,
        templateId: templateId,
        context: payload
      });
    } else if (jsonEmbed.constructor === Embeddable) {
      // It was in the cache, but the wrong type
      jsonEmbed = new JsonEmbed({
        id: id,
        templateId: templateId,
        context: payload
      });

      mergeEmbeddable(embeddables[id], jsonEmbed);
      embeddables[id] = jsonEmbed;
    } else {
      // It was in the cache, overwrite the old values
      jsonEmbed.templateId = templateId;
      jsonEmbed.context = payload;
    }

    // Notify listeners that we're about to render this template into the DOM
    jsonEmbed.before();

    // If there is a template in the registry then we can render
    if (dust.cache[templateId]) {
      // Start timing for the render event
      timerStart(id, TIME_FIELDS.RENDER);

      try {
        dust.render(templateId, jsonEmbed.context.content || jsonEmbed.context, function(err, out) {
          if (err) {
            handleDustError({ id: id, err: err, code: ERR_CODES.dustChunk });
          }

          // End timing for the render event
          timerEnd(id, TIME_FIELDS.RENDER);

          // Render this template into the DOM
          render(id, out, container);

          // Notify listeners that we've rendered this template into the DOM
          jsonEmbed.after();

          // Check if this embed is not asynchronously retrieving scripts
          if (!jsonEmbed.scriptExternalEval) {
            // End timing for this embed entirely
            timerEnd(id);
          }
        });
      } catch (err1) {
        handleDustError({ id: id, err: err1, code: ERR_CODES.dustRender });
      }
    } else {
      // No template found, so we can't render
      error = new Error('No template found in the cache with ID \'' + templateId + '\' for ' +
                        'embed with ID \'' + id + '\'');
      log.warn(error.message);
      handleDustError({ id: id, err: error, code: ERR_CODES.missingTemplate });
    }
  };

  /**
   * Embed HTML content with the given reference ID. The HTML used to render this embed will be
   * retrieved from the {@c innerHTML} of a DOM element with the ID '{fs-id}-content' which also
   * must be entity-escaped (just '&amp;' and '-' characters) and wrapped in a standard SGML
   * comment. The creation of this element is handled by the fizzy server after it fetches the
   * embed. If the content element can't be found then fz's cache will be searched, which may
   * provide the HTML if this embed has previously been rendered. If data can't be found in both
   * the cache and the DOM then the render will fail.
   *
   * @code
   * <script type='fs/embed' fs-id='mcfly' fs-uri='http://www.gigawatts.com'></script>
   * <script>
   *   fs.embedHTML('mcfly'); // Should see the content in the DOM
   * </script>
   *
   * @param {String} id
   *    the reference ID of the embed to render.
   *
   * @param {String} [html]
   *    the HTML {@c String} to embed.
   *
   * @param {String} [container]
   *    the ID of the DOM element which this embed will be inserted into. If no ID is given then
   *    the embed will be inserted before the reference element point with the ID provided by
   *    {@c id}.
   * @param {Boolean} [skipUnescape=false/undefined]
   *    Whether or not we need to unescape the HTML payload. Should be true for embeds where:
   *      fs-render-control=custom and fs-fetch-type=server
   *
   */
  fs.embedHTML = function embedHTML(id, html, container, skipUnescape) {
    var embed, result;

    html = html || getContent(id, skipUnescape);

    // No data
    if (!html) {
      return;
    }

    result = initEmbed(id, {id: id, context: html}, HtmlEmbed);
    embed = result.embed;

    if (!result.modified) {
      // It was cached, update fields
      embed.context = html;
    }

    // Notify listeners that we're about to render this HTML into the DOM
    embed.before();

    // Render the HTML into the DOM
    render(id, html, container);

    // Check if this embed is asynchronously retrieving scripts
    if (!embed.scriptExternalEval) {
      // End timing for this embed and get totals
      timerEnd(id);
    }

    // Notify listeners that we've rendered this HTML into the DOM
    embed.after();
  };

  /**
   * Register a callback to be fired after the given {@c id} is rendered. The option exists to
   * register a callback both before and after the event occurs. The callback receives two
   * arguments, the {@c id} of the embed which was just rendered and the payload for the embed.
   * If a registration happens after the render, then the callback given is fired immediately.
   *
   * @code
   * <script type='fs/embed' fs-id='mcfly' fs-uri='http://www.some-json.com'></script>
   * <script>
   *   fs.after('mcfly', function(id, payload) {
   *     // Do stuff
   *   });
   * </script>
   *
   * @param {String} id
   *    the ID specified in the 'fs-id' attribute.
   *
   * @param {Function} callback
   *    the function to call when the embed with the given id has been rendered.
   *
   * @param {Boolean} [bubbleError=false]
   *    a boolean indicating whether or not to propagate errors thrown by the callback.
   *
   * @since v1.0.0
   */
  fs.after = function after(id, callback, bubbleError) {
    listen(EVENTS.after, id, callback, bubbleError);
  };

  /**
   * Register a callback to be fired before the given {@c id} is rendered. The option exists
   * to register a callback both before and after the event occurs. The callback receives two
   * arguments, the {@c id} of the embed which was just rendered and the payload for the embed.
   * If a registration happens after the event, then the callback is fired immediately.
   *
   * @code
   * <script type='fs/embed' fs-id='mcfly' fs-uri='http://www.some-json.com'></script>
   * <script>
   *   fs.before('mcfly', function(id, payload) {
   *     // Do stuff
   *   });
   * </script>
   *
   * @param {String} id
   *    the ID specified in the 'fs-id' attribute.
   *
   * @param {Function} callback
   *    the function to call when the embed with the given id has been rendered.
   *
   * @param {Boolean} [bubbleError=false]
   *    a boolean indicating whether or not to propagate errors thrown by the callback.
   *
   * @since v1.0.0
   */
  fs.before = function before(id, callback, bubbleError) {
    listen(EVENTS.before, id, callback, bubbleError);
  };

  /**
   * @private
   * @description
   * This method is for internal use only. Register a callback to be fired before the given {@c id}
   * is rendered but after it's content has been retrieved from the server. The option exists to
   * register a callback both before and after the event occurs. The callback receives two
   * arguments, the {@c id} of the embed whose data was just fetched and an object which contains
   * fields regarding the response from the XHR request. If a registration happens after the event,
   * then the callback is fired immediately but the embed with the given {@c id} may have already
   * been rendered into the DOM.
   *
   * @code
   * <script type='fs/embed' fs-id='mcfly' fs-uri='http://www.some-json.com' fs-fetch-type='xhr'></script>
   * <script>
   *   fs.xhr('mcfly', function(id, payload) {
   *     // Do stuff
   *   });
   * </script>
   *
   * @param {String} id
   *    the ID specified in the 'fs-id' attribute.
   *
   * @param {Function} callback
   *    the function to call when the embed with the given id has been rendered.
   *
   * @param {Boolean} [bubbleError=false]
   *    a boolean indicating whether or not to propagate errors thrown by the callback.
   *
   * @since v1.2.0
   */
  fs.xhr = function xhr(id, callback, bubbleError) {
    listen(EVENTS.xhr, id, callback, bubbleError);
  };

  /**
   * Register a callback to be fired for the given {@c event} occurrence. Using this method allows
   * for the use of occurrence selectors which allow the developer to specify whether old
   * (previously fired) events, new (not previously fired) events or both are registered to. For
   * additonal information, see documentation for the {@c event} argument to this method.
   *
   * @code
   * <script>
   *  // This fires an infinite number of times for old and new 'after' events for the embed ID 'mcfly'
   *  fs.on('after', 'mcfly', function(id, payload) {
   *    // ...
   *  });
   * </script>
   *
   * <script>
   *  // This fires three times at most for new 'xhr' events for the embed ID 'mcfly'
   *  fs.on('xhr:new(3)', 'mcfly', function(id, payload) {
   *    // ...
   *  });
   * </script>
   *
   * <script>
   *  // This fires an infinite number of times for both new and previous 'custom' events for the embed ID 'mcfly'
   *  fs.on('custom:any(*)', 'mcfly', function(id, payload) {
   *    // ...
   *  });
   * </script>
   * <script type='fs/embed' fs-id='mcfly' fs-uri='http://www.json.com' fs-render-control='custom' fs-fetch-type='xhr'></script>
   *
   * @param {String} event
   *    the type of event to register the callback to. Events can be {@c "custom"}, {@c "before"},
   *    {@c "after"}, {@c "error"}, {@c "xhr"} and {@c "xhrCustom"}. Selectors are optional and can
   *    be applied to specify the occurence of selector to listen for. Valid selectors are
   *    {@c ":new"} and {@c ":any"}. The {@c "new"} selector only registers to new events. The
   *    {@c ":any"} selector registers to both previously fired events and those that may fire in
   *    the future. Selectors can also be parameterized for how many times they can trigger.
   *    {@c "after:new(N)"} means to fire on new {@c "after"} events for the given {@c id} N times
   *    at most. {@c "before:any(*)"} means to trigger on previous and future {@c "before"}
   *    events for the given {@c id} an infinite number of times. And {@c "after:new"} is
   *    synonymous to {@c "after:new(1)"}. If the selector is ommitted, eg. {@c "after"} then it is
   *    synonymous to {@c "after:any(*)"}.
   *
   * @param {String|Function} id
   *    the ID specified in the 'fs-id' attribute. For the {@c "error"} event, it can also be the
   *    callback function to listen for global error events.
   *
   * @param {Function} [callback]
   *    the function to call when the embed with the given id has been rendered. Optional if
   *    listening for global errors from the {@c "error"} event.
   *
   * @param {Boolean} [bubbleError=false]
   *    a boolean indicating whether or not to propagate errors thrown by the callback.
   *
   * @throws {TypeError} when specifying an invalid value for the {@c event} parameter.
   *
   * @see {@link fs.custom}
   * @see {@link fs.after}
   * @see {@link fs.before}
   * @see {@link fs.xhr}
   *
   * @since v1.2.0
   */
  fs.on = function on(event, id, callback, bubbleError) {
    if (event in GLOBAL_EVENTS) {
      // For 'error' event, allow the listening of the event globally
      if (typeof(id) === FN_TYPE) {
        callback = id;
        id = GLOBAL_EMBED_ID;
      }

      bubbleError = false;
    }

    listen(event, id, callback, bubbleError);
  };

  /**
   * Remove a specific callback listener from an event.
   *
   * @param {String} event
   *    the type of event to register the callback to. Can be {@c "custom"}, {@c "before"},
   *    {@c "after"}, and {@c "error"}.
   *
   * @param {String|Function} id
   *    the ID specified in the 'fs-id' attribute. For the {@c "error"} event, it can also be the
   *    callback function to listen for global error events.
   *
   * @param {Function} [callback]
   *    the function to call when the embed with the given id has been rendered. Optional if
   *    listening for global errors from the {@c "error"} event.
   *
   * @see {@link fs.on}
   *
   * @since v1.2.1
   */
  fs.cancel = function cancel(event, id, callback) {
    if (event in GLOBAL_EVENTS) {
      // For 'error' event, allow the cancelling of a global event
      if (typeof(id) === FN_TYPE) {
        callback = id;
        id = GLOBAL_EMBED_ID;
      }
    }

    unlisten(event, id, callback);
  };

  /**
   * Queue JavaScript for page injection, deferred until {@link fs.fetch} is called. Each script
   * is fetched asynchronously, but executed in FIFO order once {@link fs.fetch} is called.
   *
   * @param {String} url[,url1][,...]
   *    one or more URLs which point to JS resources.
   *
   */
  fs.js = function js() {
    _push.apply(jsToFetch, arguments);
  };

  /**
   * Fetches JS queued by the {@link fs.js} method onto the page. Each script is fetched
   * asynchronously but executed in FIFO order.
   *
   * @see {@link fs.js}
   */
  fs.fetch = function fetch() {
    var jsFile;

    while (jsFile = jsToFetch.shift()) {
      lab.queueScript(jsFile).queueWait();
    }

    lab.runQueue();
  };

  /**
   * Access an {@c Embed} instance that will be custom rendered into the DOM. It is possible to
   * access the instance in the following ways, 1) invoking the method AFTER the instance has been
   * created (typically with fizzy server, see {@link fs.setCustom}) with just the {@c id} as an
   * argument, or 2) invoking the method and passing the {@c id} and a callback {@c function}.
   * If the instance hasn't been created yet (fizzy hasn't called {@link fs.setCustom}) then the
   * callback will be invoked as soon as it is created. If the instance already exists then the
   * callback is invoked immediately. The {@c id} and the {@c Embed} instance are passed to the
   * callback. The {@c Embed} instance has an {@c embed()} method which can be invoked at any time
   * to render the embed into the DOM.
   *
   * @param {String} id
   *    the reference ID of the embed to render.
   *
   * @param {Function} [callback]
   *    the callback to invoke once the {@c Embed} has been created and is ready to be rendered
   *    into the DOM.
   *
   * @return {Object}
   *    if only the {@c id} is supplied, then this method acts as a getter and the {@c Embed}
   *    instance which has the {@c embed()} method will be returned. If the {@c id} and callback
   *    {@c function} are provided, then this will return {@c undefined} while supplying the
   *    {@c Embed} instance to the callback. If for some reason the instance could not be retrieved
   *    or is not yet ready for rendering then {@c undefined} will be returned.
   *
   * @code
   * <!-- parsed by fizzy -->
   * <script type='fs/embed' fs-id='hello' fs-uri='http://www.mcfly.com' fs-render-control='custom'></script>
   *
   * <script>
   *   fs.custom('hello', function(id, e) {
   *     // This method will be executed when the script block below is flushed to the browser
   *     assert(typeof(e.embed) === 'function');
   *     window.mcfly = e;
   *   });
   * </script>
   *
   * <script>
   *   // After parsing the above, fizzy will write this to the browser along with the payload
   *   // into the DOM
   *   fs.setCustom('hello', 'mcfly-tl', 'json');
   * </script>
   *
   * <script>
   *   // At any point after fizzy has flushed the above, you can perform the following
   *   var e = fs.custom('hello');
   *
   *   // The 'mcfly' global will have been set by now
   *   assert(e === window.mcfly);
   *
   *   // Performs fs.embed('hello', 'mcfly-tl');
   *   e.embed();
   * </script>
   *
   * <script>
   *   // Since the embed has already been embedded above, the following callback will be
   *   // invoked immediately
   *   fs.custom('hello', function(id, e) {
   *     // This will be executed immediately
   *   });
   * </script>
   *
   * @since v1.1.0
   */
  fs.custom = function custom(id, callback) {
    return lazyCustom({
      id: id, callback: callback, customKey: 'customEmbed', event: EVENTS.custom
    });
  };

  /**
   * @private
   * @description
   * Queues up an {@c Embed} instance for custom rendering. Does not actually perform any embed
   * rendering into the DOM but instead creates an {@c Embed} instance with an {@c embed()} method.
   * This instance can be accessed by using the {@link fs.custom} method. All three types of embeds
   * are supported -- JSON, HTML and {@c dupe} embeds. {@c fs.embedHTML} and {@c fs.dupe},
   * respectively. Different {@c arguments} must be supplied to this method for each type of embed.
   *
   * @param {String} id
   *    the reference ID of the embed to queue for custom rendering control.
   *
   * @param {Object} opts
   *    the options for this custom embed render.
   *
   *    @param {String} opts.type
   *       the type of embed specified for custom rendering control. Can be {@c "json"},
   *       {@c "html"} or {@c "dupe"}.
   *
   *    @param {String} [opts.templateId]
   *       required for JSON and {@c dupe} embeds, the {@c templateId} which is the identifier for
   *       the template in the {@c dust} cache. This is synonymous to the {@c "fs-alias"}
   *       attribute.
   *
   *    @param {String} [opts.data]
   *       for JSON embeds, the JSON literal payload object to use for rendering the embed. For
   *       HTML embeds, the HTML string to use for rendering the embed. Required only if the JSON
   *       or HTML data associated with the given {@c id} is not in the DOM.
   *
   *    @param {String} [opts.dupeId]
   *       for {@c dupe} embeds, the ID of the embed which has data that this {@c dupe} will
   *       reuse from the cache.
   *
   *    @param {String} [opts.container]
   *       the ID of the DOM element which this embed will be inserted into. If no ID is given
   *       then the embed will be inserted before the reference element point with the ID provided
   *       by {@c id}.
   *
   * @code
   * <!-- parsed by fizzy -->
   * <script type='fs/embed' fs-id='hello' fs-uri='http://www.mcfly.com' fs-render-control='custom'></script>
   *
   * <script>
   *   // After parsing the above, fizzy will write this to the browser along with the payload
   *   // into the DOM
   *   fs.setCustom('hello', 'mcfly-tl', 'json');
   * </script>
   *
   * @see {@link fs.custom}
   * @see {@link fs.embed}
   * @see {@link fs.embedHTML}
   * @see {@link fs.dupe}
   * @since v1.1.0
   *
   */
  fs.setCustom = function setCustom(id, opts) {
    var embed, Constructor, constructorArgs, result;

    if (!id || !opts) {
      return;
    }

    // Arguments we will be providing to the Embeddable instance constructor
    constructorArgs = { id: id };

    // Validate the type of embed specified
    switch (opts.type) {
      case EMBED_TYPE.json:
        Constructor = JsonEmbed;
        // Build up the array of arguments that will be used on the constructor for this embed
        constructorArgs.context = opts.data;
        constructorArgs.embedFunc = fs.embed;
        constructorArgs.args = [ id, opts.templateId, opts.data, opts.container ];
        break;
      case EMBED_TYPE.html:
        Constructor = HtmlEmbed;
        constructorArgs.context = opts.data;
        constructorArgs.embedFunc = fs.embedHTML;
        constructorArgs.args = [ id, opts.data, opts.container ];
        break;
      case EMBED_TYPE.dupe:
        Constructor = JsonEmbed;
        constructorArgs.context = opts.data;
        constructorArgs.embedFunc = fs.dupe;
        constructorArgs.args = [ id, opts.dupeId, opts.templateId, opts.container ];
        break;
      default:
        log.warn('Unknown embed type \'' + opts.type + '\' specified for embed with ' +
                 'ID \'' + id + '\', embed types must be \'json\', \'html\', or \'dupe\'');
        return;
    }

    result = initEmbed(id, constructorArgs, Constructor);
    embed = result.embed;

    if (!result.modified) {
      // Check if it's a JsonEmbed, if so, overwrite the templateId field
      if (embed.constructor === JsonEmbed) {
        embed.templateId = constructorArgs.templateId;
      }

      embed.context = constructorArgs.context;
      embed.initCustom(constructorArgs);
    }

    // Notify any listeners that this embed's data is prepared for rendering
    embed.custom();
    return embed.customEmbed;
  };

  /**
   * Specify that an embed's data is to be requested via {@c XMLHttpRequest} rather than with the
   * fizzy server. This defers retrieval of the payload from the server to the client side. Once
   * the data is retrieved, it will be embedded immediately if {@c opts.renderControl} is
   * {@c "immediate"} or at the developer's discretion if {@c opts.renderControl} is {@c "custom"}.
   *
   * @param {String} id
   *    the reference ID of the embed. This value should be unique and may be used as a DOM element
   *    ID in the DOM. If no container ID is specified in the {@c opts} {@c Object} and rendering
   *    control is at the discretion of the fizzy library, then the element with ID equal to
   *    {@c id} will be used as a reference point for where to embed.
   *
   * @param {Object} opts
   *    the options for this embed {@c XMLHttpRequest}.
   *
   *    @param {String} opts.url
   *       the URI to make the AJAX request to for this embed's data.
   *
   *    @param {String} [opts.templateId]
   *       optional for JSON embeds, the {@c templateId} of the template in the {@c dust} cache.
   *       If not provided then the {@c __default__} value specified in the embed response headers
   *       will be used. This is synonymous to the {@c "fs-alias"} attribute.
   *
   *    @param {String} [opts.renderControl="immediate"]
   *       specifies where the decision to render the embed is made. The default value is
   *       {@c "immediate"}, which will render the embed as soon as the response returns. The value
   *       {@c "custom"} can be specified, meaning the embed will not render until specified
   *       by the developer. See {@link fs.custom} for information on how to render a
   *       client-controlled (custom) embed. A final option is to use {@c "server"}, which
   *       specifies that this embed will be rendered on the server-side (not yet supported).
   *
   *    @param {String} [opts.container]
   *       the ID of the DOM element to append this embed to once the AJAX request completes.
   *       The library will prefer to append to the container if provided as opposed to using the
   *       {@c id} as a reference for where to render.
   *
   *    @param {Number} [opts.timeout=30000]
   *       the maximum amount of time (in milliseconds) the XHR call will spend waiting on the
   *       upstream server. If the timeout limit is reached the call will abort and will set the
   *       status as {@c 504} with empty {@c responseText}.
   *
   *    @param {Boolean} [opts.cache=false]
   *       by default, fizzy will append a random query parameter to XHR requests made. Note that
   *       setting this to {@c true} will prevent this cache busting technique and may cause XHR
   *       requests made in some browsers to return results from the their cache.
   *
   *    @param {Boolean} [opts.required=false]
   *       whether or not this embed is required for the page. If this embed is required and if the
   *       embed returns a non-200 (or 204) response code, then fizzy will treat it as a hard
   *       failure and redirect the page.
   *
   * @code
   * <!-- parsed by fizzy -->
   * <script type='fs/embed' fs-id='delorean' fs-uri='http://www.mcfly.com' fs-fetch-type='xhr'></script>
   *
   * <script>
   *   // After parsing the above, fizzy will write this to the browser
   *   fs.embedXHR('delorean', { url: 'http://www.mcfly.com' });
   * </script>
   *
   * @see {@link fs.embed}
   * @see {@link fs.embedHTML}
   * @see {@link fs.custom}
   * @see {@link fs.dupeXHR}
   * @since v1.2.0
   *
   */
  fs.embedXHR = function embedXHR(id, opts) {
    var hdrs, func, localOpts;

    if (!id) {
      return;
    }

    // Defaults
    localOpts = {
      renderControl: 'immediate',
      wait: false,
      timeout: 30000
    };

    hdrs = {};

    merge(localOpts, opts, true);

    if (localOpts.renderControl === RENDER_CONTROL.server) {
      hdrs.Accept = 'text/html';
    }

    merge(hdrs, globalConfig.xhrHeaders);

    doXHR(localOpts.url, hdrs, function(xhr, timeout) {
      // The template URLs specified by the X-FS-TL header
      var templateUrls,

          // Iteration variable
          templateUrl,

          // The template key mapping specified by the X-FS-Template-Keys
          templateKeys,

          // Alias for the resolved templateId
          templateId,

          // Embed instance for this fetch
          embed,

          // Script to execute once all template URLs have been resolved
          func,

          // Batch status object which maps each templateId to the resolved name and status
          batch,

          // Evaluated status of the XHR
          status,

          // Evaluated Content-Type of the XHR
          contentType,

          result, msg, i;

      status = timeout ? 504 : xhr.status;

      // TODO Create HtmlEmbed if text/html
      result = initEmbed(id, {id: id, xhrObj: { status: status }}, JsonEmbed);
      embed = result.embed;

      // It was in the cache (with the correct type), overwrite old fields
      if (!result.modified) {
        embed.xhrObj = {status: status};
      }

      // Check if we didn't time out
      if (!timeout) {
        // Store the embed error message if it exists
        embed.errorMsg = xhr.getResponseHeader(EMBED_ERROR_HDR);
      }

      // Fire XHR event
      embed.xhr();

      // Check for a successful response status code
      if (status === 200 || status === 204) {
        contentType = xhr.getResponseHeader(CONTENT_TYPE_HDR);

        // Check Content-Type to determine how to perform the embed
        if (contentType.indexOf(EMBED_TYPE.json) !== -1) {
          // TODO Static content headers?
          if (xhr.getResponseHeader(TL_KEYS_HDR) && xhr.getResponseHeader(TL_KEYS_HDR).length) {
            templateKeys = mapSplit(xhr.getResponseHeader(TL_KEYS_HDR));
          } else {
            templateKeys = {};
          }

          // Resolve the templateId
          templateId = templateKeys[localOpts.templateId] || localOpts.templateId ||
                       templateKeys.__default__;

          if (localOpts.renderControl === RENDER_CONTROL.custom) {
            func = function() {
              // Custom embed render control
              fs.setCustom(id, {
                templateId: templateId,
                data: parseJSON(id, xhr.responseText),
                type: EMBED_TYPE.json,
                container: localOpts.container
              });
            };
          } else {
            func = function() {
              // Embed instantly
              fs.embed(id, templateId, parseJSON(id, xhr.responseText), localOpts.container);
            };
          }

          // Check if this was a batch request
          if (xhr.getResponseHeader(BATCH_STATUS_HDR)) {
            batch = {};

            // Split up the statuses
            forEach(xhr.getResponseHeader(BATCH_STATUS_HDR).split(','), function(part) {
              var parts;

              parts = part.split('=');
              batch[parts[0]] = {
                status: parts[1],
                templateKey: templateKeys[parts[0]]
              };
            });

            // Check if a default template key mapping exist
            if (templateKeys.__default__) {
              // Provide an explicit mapping for __default__ for dupes that may need to use it
              batch.__default__ = {
                status: 200,
                templateKey: templateKeys.__default__
              };
            }

            // Set up for dupe calls to access
            embed.batch = batch;
          }

          // Check if script dependencies exist
          if (xhr.getResponseHeader(TL_HDR) && xhr.getResponseHeader(TL_HDR).length) {
            // Get script dependencies first before embedding
            templateUrls = xhr.getResponseHeader(TL_HDR).split(',');
            i = 0;

            do {
              // Make sure there is no whitespace
              templateUrl = templateUrls[i].replace(/\s/g, '');

              // Check
              if (templateUrl.length) {
                // Retrieve asynchronously
                lab.queueScript(templateUrls[i]);
              }
            } while (templateUrls[++i]);
          }

          // Embed when dependencies are loaded
          lab.queueWait(func).runQueue();
        } else if (contentType.indexOf(EMBED_TYPE.html) !== -1) {
          // Handle HTML embedding based on how the renderControl is specified
          if (localOpts.renderControl === RENDER_CONTROL.custom) {
            fs.setCustom(id, {
              data: xhr.responseText,
              type: EMBED_TYPE.html,
              container: localOpts.container
            });
          } else {
            fs.embedHTML(id, xhr.responseText, localOpts.container);
          }
        } else {
          msg = 'Unknown Content-Type \'' + contentType +
                '\' received for XHR embed with ID \'' + id + '\' and URL '+
                '\'' + localOpts.url + '\'';
          log.warn(msg);
          emitError({ id: id, code: ERR_CODES.xhrContentType, message: msg });
        }
      } else {
        // Log, unsuccessful status code
        msg = 'Unsuccessful status code \'' + status + '\' received for XHR embed with ' +
              'ID \'' + id + '\' and URL \'' + localOpts.url + '\'';
        log.warn(msg);
        emitError({ id: id, code: ERR_CODES.xhrStatus, message: msg });

        // Check if this is a required embed
        if (localOpts.required) {
          // Retrieval failed, so perform redirect
          fs.redirect(embed.errorMsg, globalConfig.failureRedirect);
        }
      }

    }, localOpts.timeout, localOpts.cache);

    // Register the callback
    if (localOpts.callback) {
      listen(EVENTS.xhr, id, localOpts.callback);
    }
  };

  /**
   * Specify that a JSON embed is to use the payload from another, which was (or will be) requested
   * via {@link fs.embedXHR}. This dupe embed will be rendered immediately if
   * {@c opts.renderControl} is ommitted or {@c "immediate"}, or it can be custom rendered if
   * {@c "custom"} is provided.
   *
   * @param {String} id
   *    the reference ID of the embed. This value should be unique and may be used as a future DOM
   *    element ID. If no container ID is specified in the {@c opts} {@c Object} and rendering
   *    control is at the discretion of the fizzy library, then the element with ID equal to
   *    {@c id} will be used as a reference point for where to embed.
   *
   * @param {String} dupeId
   *    the reference ID of the embed that originally used the JSON payload.
   *
   * @param {Object} [opts]
   *    the options for this duplicate embed.
   *
   *    @param {String} [opts.templateId]
   *       the {@c templateId} of the template in the {@c dust} cache. If not provided then the
   *       {@c __default__} value specified in the embed response headers will be used. This is
   *       synonymous to the {@c "fs-alias"} attribute.
   *
   *    @param {String} [opts.renderControl="immediate"]
   *       specifies where the decision to render the embed is made. The default value is
   *       {@c "immediate"}, which will render the embed as soon as the response returns. The value
   *       {@c "custom"} can be specified, meaning the embed will not render until specified
   *       by the developer. See {@link fs.custom} for information on how to render a
   *       client-controlled (custom) embed.
   *
   *    @param {String} [opts.container]
   *       the ID of the DOM element to append this embed to once the AJAX request completes.
   *       The library will prefer to append to the container if provided as opposed to using the
   *       {@c id} as a reference for where to render.
   *
   *    @param {Boolean} [opts.required=false]
   *       whether or not this embed is required for the page. If this embed is required and if the
   *       embed returns a non-200 (or 204) response code, then fizzy will treat it as a hard
   *       failure and redirect the page.
   *
   * @code
   * <!-- parsed by fizzy -->
   * <script type='fs/embed' fs-id='delorean' fs-uri='http://www.mcfly.com' fs-fetch-type='xhr'></script>
   *
   * <!-- also parsed by fizzy -->
   * <script type='fs/embed' fs-id='hoverboard' fs-uri='http://www.mcfly.com'></script>
   *
   * <script>
   *   // After parsing the above, fizzy will write this to the browser
   *   fs.embedXHR('delorean', { url: 'http://www.mcfly.com' });
   *   fs.dupeXHR('hoverboard', 'delorean');
   * </script>
   *
   * @see {@link fs.custom}
   * @see {@link fs.dupe}
   * @see {@link fs.embedXHR}
   * @since v1.2.0
   *
   */
  fs.dupeXHR = function dupeXHR(id, dupeId, opts) {
    if (dupeXHRQueue[id]) {
      return;
    }

    dupeXHRQueue[id] = 1;
    opts = opts || {};

    // Hook in once the XHR for the embed to duplicate is done
    fs.on('xhr:any', dupeId, function(dupeId, o) {
      var dupeEmbed = embeddables[dupeId], renderDupeCallback, errCallback, afterCallback;

      // Check if the request was successful
      if (o.status === 200 || o.status === 204) {
        // Render after the embed this is a dupe of has rendered
        renderDupeCallback = function(dupeId) {
          var batchObj, status;

          batchObj = dupeEmbed.batch[opts.templateId] || dupeEmbed.batch.__default__;
          status = parseInt(batchObj.status, 10);

          // Make sure status was acceptable
          if (status === 200 || status === 204) {
            // Check what render control is specified
            if (!opts.renderControl || (opts.renderControl === RENDER_CONTROL.immediate)) {
              // Embed immediately
              fs.dupe(id, dupeId, batchObj.templateKey, opts.container);
            } else if (opts.renderControl === RENDER_CONTROL.custom) {
              // Custom embed
              fs.setCustom(id, {
                dupeId: dupeId,
                templateId: batchObj.templateKey,
                container: opts.container,
                type: EMBED_TYPE.dupe
              });
            } else {
              log.warn('Unknown embed type \'' + opts.type + '\' specified for embed with ' +
                       'ID \'' + id + '\', embed types must be \'json\', \'html\', or \'dupe\'');
            }
          } else if (opts.required) {
            // Redirect if this was required
            fs.redirect(dupeEmbed.errorMsg, globalConfig.failureRedirect);
          }

          // Clear this from the queue
          delete dupeXHRQueue[id];
        };

        // Registered to the parent embed's error event
        errCallback = function() {
          renderDupeCallback.apply(window, arguments);

          // Remove this listener function from the other event we registered it to
          unlisten(EVENTS.after, dupeId, afterCallback);
        };

        // Registered to the parent embed's after event
        afterCallback = function() {
          renderDupeCallback.apply(window, arguments);

          // Remove this listener function from the other event we registered it to
          unlisten(EVENTS.error, dupeId, errCallback);
        };

        // If an error occurs during embedding the parent, this dupe should still come out fine
        fs.on(EVENTS.error, dupeId, errCallback, true);

        // Register to the event after the parent embed renders
        fs.after(dupeId, afterCallback, true);

      } else if (opts.required) {
        // Redirect if this was required
        fs.redirect(dupeEmbed.errorMsg, globalConfig.failureRedirect);

        // Clear this from the queue
        delete dupeXHRQueue[id];
      }
    }, true);

    return 1;
  };

  /**
   * Access an {@c Embed} instance whose data is to be retrieved. It is possible to access the
   * instance in the following ways, 1) invoking the method AFTER the instance has been created
   * (with fizzy server) with just the {@c id} as an argument, or 2) invoking the method and
   * passing the {@c id} and a callback {@c function}. If the instance hasn't been created yet
   * (fizzy hasn't provided details for the {@c XMLHttpRequest}) then the callback will be invoked
   * as soon as it is created. If the instance already exists then the callback is invoked
   * immediately. The {@c id} and the {@c Embed} instance are passed to the callback. The
   * {@c Embed} instance has an {@c xhr()} method which can be invoked at any time to retrieve the
   * embed's data. Once the data has been received, it will be rendered into the DOM immediately
   * if {@c opts.renderControl} is {@c "immediate"} or render control can be at the developer's
   * discretion if {@c opts.renderControl} is {@c "custom"}.
   *
   * @param {String} id
   *    the reference ID of the embed to be requested with XHR.
   *
   * @param {Function} [callback]
   *    the callback to invoke once the {@c Embed}'s XHR has completed.
   *
   * @return {Object}
   *    if only the {@c id} is supplied, then this method acts as a getter and the {@c Embed}
   *    instance which has the {@c xhr()} method will be returned. If the {@c id} and callback
   *    {@c function} are provided, then this will return {@c undefined} while supplying the
   *    {@c Embed} instance to the callback. If for some reason the instance could not be retrieved
   *    or is not yet ready for XHR retrieval then {@c undefined} will be returned.
   *
   * @code
   * <!-- parsed by fizzy -->
   * <script type='fs/embed' fs-id='hello' fs-uri='http://www.mcfly.com'
   *         fs-fetch-type='xhr' fs-fetch-control='custom'></script>
   *
   * <script>
   *   fs.xhrCustom('hello', function(id, e) {
   *     // This method will be executed when the script block below is flushed to the browser
   *     assert(typeof(e.xhr) === 'function');
   *     window.mcfly = e;
   *   });
   * </script>
   *
   * <script>
   *   // After parsing the above, fizzy will write this to the browser along with the payload
   *   // into the DOM
   *   fs._server.setCustomXHR('hello', {url: 'http://www.mcfly.com'});
   * </script>
   *
   * <script>
   *   // At any point after fizzy has flushed the above, you can perform the following
   *   var e = fs.xhrCustom('hello');
   *
   *   // The 'mcfly' global will have been set by now
   *   assert(e === window.mcfly);
   *
   *   // Performs asynchronous XMLHttpRequest to the fs-uri specified, will render the embed
   *   // immediately once the data arrives since fs-render-control is not 'custom'
   *   e.xhr();
   * </script>
   *
   * @since v1.3.4
   *
   */
  fs.xhrCustom = function xhrCustom(id, callback) {
    return lazyCustom({
      id: id, callback: callback, customKey: 'customXHR', event: EVENTS.xhrCustom
    });
  };

  /**
   * @see {@link fs.xhrCustom}
   * @since v1.2.0
   *
   */
  fs.customXHR = fs.xhrCustom;

  /**
   * Allow fizzyserver to prepare a customXHR data retrieval.
   *
   * @param {String} id
   *    the reference ID of the embed. This value should be unique and may be used as a DOM element
   *    ID in the DOM. If no container ID is specified in the {@c opts} {@c Object} and rendering
   *    control is at the discretion of the fizzy library, then the element with ID equal to
   *    {@c id} will be used as a reference point for where to embed.
   *
   * @param {Object} opts
   *    the options for this embed {@c XMLHttpRequest}.
   *
   *    @param {String} opts.url
   *       the URI to make the AJAX request to for this embed's data.
   *
   *    @param {String} [opts.templateId]
   *       optional for JSON embeds, the {@c templateId} of the template in the {@c dust} cache.
   *       If not provided then the {@c __default__} value specified in the embed response headers
   *       will be used. This is synonymous to the {@c "fs-alias"} attribute.
   *
   *    @param {String} [opts.renderControl="immediate"]
   *       specifies where the decision to render the embed is made. The default value is
   *       {@c "immediate"}, which will render the embed as soon as the response returns. The value
   *       {@c "custom"} can be specified, meaning the embed will not render until specified
   *       by the developer. See {@link fs.custom} for information on how to render a
   *       client-controlled (custom) embed. A final option is to use {@c "server"}, which
   *       specifies that this embed will be rendered on the server-side (not yet supported).
   *
   *    @param {String} [opts.container]
   *       the ID of the DOM element to append this embed to once the AJAX request completes.
   *       The library will prefer to append to the container if provided as opposed to using the
   *       {@c id} as a reference for where to render.
   *
   *    @param {Number} [opts.timeout=30000]
   *       the maximum amount of time (in milliseconds) the XHR call will spend waiting on the
   *       upstream server. If the timeout limit is reached the call will abort and will set the
   *       status as {@c 504} with empty {@c responseText}.
   *
   *    @param {Boolean} [opts.cache=false]
   *       by default, fizzy will append a random query parameter to XHR requests made. Note that
   *       setting this to {@c true} will prevent this cache busting technique and may cause XHR
   *       requests made in some browsers to return results from the their cache.
   *
   *    @param {Boolean} [opts.required=false]
   *       whether or not this embed is required for the page. If this embed is required and if the
   *       embed returns a non-200 (or 204) response code, then fizzy will treat it as a hard
   *       failure and redirect the page.
   *
   * @see {@link fs.xhrCustom}
   * @since v1.2.0
   *
   */
  server.setCustomXHR = function setCustomXHR(id, opts) {
    var embed, Constructor, constructorArgs, result;

    if (!id || !opts) {
      return;
    }

    constructorArgs = { id: id, args: [id, opts], xhrFunc: fs.embedXHR };
    Constructor = opts.templateId ? JsonEmbed : HtmlEmbed;
    result = initEmbed(id, constructorArgs, Constructor);
    embed = result.embed;

    if (!result.modified) {
      // Check if it's a JsonEmbed, if so, overwrite the templateId field
      if (embed.constructor === JsonEmbed) {
        embed.templateId = constructorArgs.templateId;
      }

      embed.initCustomXHR(constructorArgs);
    }

    embed.xhrCustom();
  };

  /**
   * When SHTF during a dust render call
   */
  function handleDustError(o) {
    o.willThrow = typeof(o.willThrow) === 'undefined' ? true : o.willThrow;
    timerAbort(o.id, TIME_FIELDS.RENDER);

    if (!o.err.message) { o.err.message = 'Issue encountered during dust.render() call.'; }

    log.warn(o.err.message);
    emitError({ id: o.id,
                code: o.code,
                thrown: o.err,
                message: o.err.message });

    if (o.willThrow) { throw o.err; }
  }

  /**
   * Initializes an embed with the given options. Handles overriding or merging of an existing
   * embed in the cache. Returns an object to the caller with the embed as well as whether or not
   * it was modified.
   */
  function initEmbed(id, opts, Constructor) {
    var ret = { embed: embeddables[id], modified: false };

    if (!ret.embed) {
      embeddables[id] = ret.embed = new Constructor(opts);
    } else if (Constructor !== Embeddable && ret.embed.constructor === Embeddable) {
      ret.embed = new Constructor(opts);
      mergeEmbeddable(embeddables[id], ret.embed);
      embeddables[id] = ret.embed;
    } else {
      return ret;
    }

    ret.modified = true;
    return ret;
  }

  /**
   * Split a string in the format k=v,k2=v2,k3=v3 and create a map of the values.
   */
  function mapSplit(s) {
    var arr = s.split(','), ret = {}, key, part, parts, i;

    for (i = 0; i < arr.length; i++) {
      // Trim
      part = arr[i].replace(/\s/g, '');

      if (part.length) {
        parts = part.split('=');

        // Trim
        key = parts[0].replace(/\s/g, '');

        if (key.length && parts[1].length) {
          ret[key] = parts[1];
        }
      }
    }

    return ret;
  }

  /**
   * Helper for the ECMA standard Array.prototype.forEach
   */
  function forEach(arr, fn) {
    var i;

    if (Array.prototype.forEach) {
      Array.prototype.forEach.call(arr, fn);
    } else {
      i = 0;

      do {
        fn(arr[i], i, arr);
      } while (arr[++i]);
    }
  }

  /**
   * Redirect to a URL while the page is loading. Primarily used for failed embeds which were
   * marked as required.
   *
   * @param {String} [errorMsg]
   *    the error message (or query parameters) to append to the URL.
   *
   * @param {String} url
   *    the URL to redirect to.
   */
  fs.redirect = function redirect(errorMsg, url, formatOnly) {
    var redirectMethod, fullUrl;

    // Check if errorMsg is provided, if so, format the URL
    if (errorMsg) {
      // Check if there is already a query in the URL
      if (url.indexOf('?') !== -1) {
        // Add the ampersand if we need to
        if (url[url.length-1] !== '?' && (url[url.length-1] !== '&')) {
          url += '&';
        }
      } else {
        url += '?';
      }

      // Remove the prefixed ampersand, we've already formatted the URL to operate without it
      if (errorMsg.indexOf('&') === 0) {
        errorMsg = errorMsg.substring(1);
      }

      fullUrl = url + errorMsg;
    } else {
      fullUrl = url;
    }

    // Check if we need to prepend the protocol
    if (fullUrl.indexOf('http://') !== 0 && fullUrl.indexOf('https://') !== 0) {
      fullUrl = 'http://' + fullUrl;
    }

    // Backwards compatibility, unescape &squot; and &quot;
    if( !fs.isUniEscapeOn() ) {
      fullUrl = unescapeQuotes(fullUrl);
    }

    // Primarily for testing
    if (formatOnly) {
      return fullUrl;
    }

    // Modern browser?
    if (document.addEventListener) {
      redirectMethod = function redirectMethod() {
        document.removeEventListener('DOMContentLoaded', redirectMethod, false);
        window.location.href = fullUrl;
      };

      document.addEventListener('DOMContentLoaded', redirectMethod, false);

      // Fall back, in case DOMContentLoaded doesn't fire
      window.addEventListener('load', redirectMethod, false);
    } else if (document.attachEvent) {
      redirectMethod = function redirectMethod() {
        document.detachEvent('onreadystatechange', redirectMethod);
        window.location.href = fullUrl;
      };

      // IE crap
      document.attachEvent('onreadystatechange', redirectMethod);

      // Fall back, in case onreadystatechange doesn't fire
      window.attachEvent('onload', redirectMethod);
    }

    if (document.readyState === 'complete') {
      return setTimeout(redirectMethod, 1);
    }
  };

  /**
   * Get the payload for the given reference ID. If the Content-Type returned from the fs-uri
   * given for the reference ID is JSON then this method returns a JSON object. If it is HTML,
   * then the HTML string is returned. Will return {@c undefined} if the {@c id} given is not
   * in the payload cache or if the embed has not been rendered yet.
   *
   * @code
   * <script type='fs/embed' fs-id='something' fs-uri='http://www.some-json.com'></script>
   * <script>
   *   fs.payload('something'); // Returns a JSON object
   * </script>
   *
   * @param {String} id
   *    the DOM reference ID for the {@c &lt;script&gt;} element which is used to render the embed.
   *
   * @return {String|Object}
   *    a {@c String} if the reference ID was for an HTML embed or a JSON {@c Object} if it was for
   *    a template. Returns {@c undefined} if the given {@c id} was not registered, or if the
   *    given embed with {@c id} has not been rendered into the DOM yet.
   */
  fs.payload = function payload(id) {
    return embeddables[id] ?  embeddables[id].context : undefined;
  };

  
  /**
   * Resets any stateful information the {@c fs} library has stored. This includes caches and
   * static resources queued for loading with the {@link fs.js} method.
   */
  fs.reset = function reset() {
    xhrPool = [];
    jsToFetch = [];
    dupeXHRQueue = {};
    embeddables = {};
    internalTime = {};
    jsToFetch = [];
    globalConfig = clone(DEFAULT_CONFIG,true);
    window.$LAB = lab = lab.sandbox();
  };

  /**
   * Get the current build version of the fz.js library.
   * @return {String} the current build version.
   */
  fs.version = function version() {
    return VER;
  };

  /**
   * @private
   * @description
   * This namespace is for use only by fizzyserver.
   */
  fs._server = server;

  /**
   * Simulate the firing of an event from fizzyserver.
   */
  server.fire = function fire(id, opts) {
    if (!opts) {
      return;
    }

    if (opts.type === "html"){
      initEmbed(id, {id: id, context: {}}, HtmlEmbed);
    }
    embeddables[id][opts.event](id);

  };

  /**
   * Create the standard XMLHttpRequest object
   */
  function getStandardXHR() {
    return new window.XMLHttpRequest();
  }

  /**
   * Create the IE proprietary XMLHttpRequest object
   */
  function getMsXHR() {
    return new window.ActiveXObject('Microsoft.XMLHTTP');
  }

  /**
   * Add random query parameter to prevent unwanted caching
   */
  function cacheBust(url) {
    if (url.indexOf('?') !== -1) {
      url += '&';
    } else {
      url += '?';
    }

    url += '_=' + (+new Date());
    return url;
  }

  /**
   * Check if a timer for the given ID and field is running
   */
  function timerRunning(id, field) {
    var timeObj = getTimeObject(id, field);

    if (!timeObj || !timeObj.isRunning) {
      return false;
    }

    return true;
  }

  /**
   * Get or initialize the XMLHttpRequest object depending on the user agent.
   */
  function doXHR(url, hdrMap, callback, timeout, cache) {
    var xhr, hdrName, aborted, t;

    if (!getXHR) {
      try {
        xhr = getStandardXHR();
        getXHR = getStandardXHR;
      } catch (e) {
        xhr = getMsXHR();
        getXHR = getMsXHR;
      }
    }

    // Check object pool
    if (xhrPool.length) {
      xhr = xhrPool.pop();
    } else if (!xhr) {
      // No resources available, allocate new ones
      xhr = getXHR();
    }

    // Add anti-cache query parameter to the URL to prevent IE caching
    xhr.open('GET', cache ? url : cacheBust(url), true);

    // Add headers
    for (hdrName in hdrMap) {
      if (hdrMap.hasOwnProperty(hdrName)) {
        xhr.setRequestHeader(hdrName, hdrMap[hdrName]);
      }
    }

    xhr.onreadystatechange = function() {
      // If we have aborted
      if (aborted) {
        callback(xhr, true);
      } else if (xhr.readyState !== 4) {
        return;
      } else {
        // Check if the abort timeout interval is still running
        if (t) {
          // Clear the timeout interval
          window.clearTimeout(t);
          t = null;
        }

        // readyState === 4
        callback(xhr, false);
      }

      // Reset and pool the object
      xhr.onreadystatechange = null;
      xhrPool.push(xhr);
    };

    xhr.send(null);

    // Handle timeout if provided
    if (timeout > 0) {
      // Abort the client request if the timeout exceeds the limit
      t = window.setTimeout(function() {
        aborted = true;
        xhr.abort();
      }, timeout);
    }
  }

  /**
   * Start timing for a given ID and timing field
   */
  function timerStart(id, field) {
    var timeObj;

    // Nothing in the timer registry means the embed was not specified to have timing
    if (!internalTime[id]) {
      if (IS_DBG) {
        fs.timing(id); //Calling fs.timing() with no callback will essentially begin recording timings on the embed
      } else {
        return;
      }
    }

    timeObj = getTimeObject(id, field);
    timeObj.fragmentStart = +new Date();
    timeObj.isRunning = true;
  }

  /**
   * End timing for a given ID and timing field
   */
  function timerEnd(id, field) {
    var timeObj = getTimeObject(id, field), internalTimeObj, embed;

    if (!timeObj) {
      return;
    }

    // Check if timer has started, if not, we can't correctly calculate the delta
    if (timeObj.isRunning) {
      // Increment to the total
      timeObj.total += (+new Date()) - timeObj.fragmentStart;

      // Reset the time fragment starting time
      timeObj.isRunning = false;
    }

    // Check if no field is specified
    if (!field || field === TIME_FIELDS.TOTAL) {
      // If field is unspecified then we must be stopping the timer for the total aggregate
      // time, which means we must clean up and populate the embed's finalized time
      embed = embeddables[id];

      // Full timing object with all of our timing information for the embed with the given ID
      internalTimeObj = internalTime[id];

      // parse and parseProcessing timings
      embed.timings.parseProcessing = internalTimeObj.parseProcessing.total;
      embed.timings.parse = internalTimeObj.parse.total;

      // render and renderProcessing timings
      embed.timings.renderProcessing = internalTimeObj.renderProcessing.total;
      embed.timings.render = internalTimeObj.render.total;

      // scriptExternalEval and scriptInlineEval timings
      // Check if we fetched external scripts
      if (embed.scriptExternalEval) {
        // Subtract the synchronous eval time since it is calculated into the scriptExternalEval time
        internalTimeObj.scriptExternalEval.total -= internalTimeObj.scriptInlineEval.total;
      } else {
        internalTimeObj.scriptExternalEval.total = 0;
      }

      embed.timings.scriptExternalEval = internalTimeObj.scriptExternalEval.total;
      embed.timings.scriptInlineEval = internalTimeObj.scriptInlineEval.total;

      // after queue processing timings
      embed.timings.afterQueueProcessing = internalTimeObj.afterQueueProcessing.total;

      // before queue processing timings
      embed.timings.beforeQueueProcessing = internalTimeObj.beforeQueueProcessing.total;

      // Totals of everything
      embed.timings.total = internalTimeObj.parseProcessing.total +
                            internalTimeObj.parse.total +
                            internalTimeObj.renderProcessing.total +
                            internalTimeObj.render.total +
                            internalTimeObj.scriptExternalEval.total +
                            internalTimeObj.scriptInlineEval.total +
                            internalTimeObj.afterQueueProcessing.total +
                            internalTimeObj.beforeQueueProcessing.total;

      embed.timings.startTs = timeObj.fragmentStart;
      embed.timings.endTs = embed.timings.startTs + embed.timings.total;

      // Flag timing as complete
      embed.timingComplete = true;

      // Invoke the callback if it exists
      if (embed.timingCallback) {
        embed.timingCallback(embed.timings);
      }

      // Clean up
      internalTime[id] = null;
      delete internalTime[id];
    }
  }

  /**
   * Abort timing for a given ID and timing field
   */
  function timerAbort(id, field) {
    var timeObj = getTimeObject(id, field);

    if (!timeObj) {
      return;
    }

    timeObj.total = 0;
    timeObj.isRunning = false;
  }

  /**
   * Get the timing object for this field
   */
  function getTimeObject(id, field) {
    if (!internalTime[id]) {
      return;
    }

    // If no field was specified
    if (!field) {
      // Default to the total
      field = TIME_FIELDS.TOTAL;
    }

    return internalTime[id][field];
  }

  /**
   * Convenience method for getting the contents of a script tag.
   */
  function getScriptContents(script) {
    return script.text || script.textContent || script.innerHTML || '';
  }

  /**
   * Take an array of scripts and construct a script loading and/or execution queue.
   */
  function queueScripts(scripts, id) {
    /*jshint loopfunc:true */
    var script, scriptText, embed;

    embed = embeddables[id];

    // Check if this ID is to be timed
    if (internalTime[id]) {
      // Queue additional call to start timing for this field in case there are external fetches
      lab.queueWait(function() {
        timerStart(id, TIME_FIELDS.SCRIPT_EXT_EVAL);
      });
    }

    while (script = scripts.shift()) {
      // Check if this script has an invalid script type
      if (script.type && !SCRIPT_TYPE_RXP.test(script.type)) {
        // Don't process it
        continue;
      }

      // Remove it from the original container to avoid any further processing elsewhere
      script.parentNode.removeChild(script);

      // If this is an external script request
      if (script.src) {
        // If we need to record timings
        if (!embed.scriptExternalEval && internalTime[id]) {
          // Flag that we are fetching external scripts
          embed.scriptExternalEval = true;
        }

        // Fetch it and provide as an argument to labJS to maintain script execution order
        lab.queueScript(script.src).queueWait();
      } else {
        // It's not an external script, so it may be inline
        scriptText = getScriptContents(script);

        // If there's some inline JS
        if (scriptText) {
          // Perform an eval call in the global namespace on the contents
          lab.queueWait((function(s) {
            return function() {
              // Start recording script eval time
              timerStart(id, TIME_FIELDS.SCRIPT_INL_EVAL);

              // Perform eval of the inline script
              _eval(s);

              // End recording script eval time
              timerEnd(id, TIME_FIELDS.SCRIPT_INL_EVAL);
            };
          }(scriptText)));
        }
      }
    }

    // Set up a call to stop this timer
    if (internalTime[id]) {
      lab.queueWait(function() {
        timerEnd(id, TIME_FIELDS.SCRIPT_EXT_EVAL);
      });
    }

    // Check if we are fetching external scripts
    if (embed.scriptExternalEval) {
      // Queue additional call to end timing for this field
      lab.queueWait(function() {
        timerEnd(id);
      });
    }
  }

  /**
   * Render the given content into the DOM.
   */
  function render(id, content, containerId) {
    var ref, container, tmp, frag, scripts;

    // Start timing the fizzy rendering
    timerStart(id, TIME_FIELDS.RENDER_PROCESS);

    // Prefer to use container over the reference point script
    if (containerId) {
      container = document.getElementById(containerId);

      if (!container) {
        log.warn('No container node found with ID \'', containerId, '\', attempting to use ' +
                 'id \'', id, '\' instead');
      }
    }

    // Use the reference point since no container element found or specified
    if (!container) {
      ref = document.getElementById(id);

      if (!ref) {
        var msg = 'No reference script found with ID \'' + id + '\', cannot render';
        log.warn(msg);
        timerAbort(id, TIME_FIELDS.RENDER_PROCESS);
        emitError({ id: id, code: ERR_CODES.fizzyRender, message: msg });
        return;
      }
    }

    // Create a temporary container to construct nodes
    tmp = document.createElement(DIV);

    if (!IS_IE) {
      // Treat other browsers normally
      tmp.innerHTML = content;
    } else {
      // IE is retarded and does not acknowledge script tags unless there is "visible" content
      // that preceeds it, so we compromise with an underscore
      tmp.innerHTML = '_' + content;

      // Clean it up now
      tmp.removeChild(tmp.firstChild);
    }

    // Use a DocumenFragment to prevent DOM structure pollution with unnecessary containers
    frag = document.createDocumentFragment();

    // Get scripts and execute them after non-JS content is in the DOM
    scripts = tmp.getElementsByTagName(SCRIPT_TAG);
    scripts = (scripts instanceof Array) ? scripts : toArray(scripts);

    // Queue up scripts for fetching or evaluation
    queueScripts(scripts, id);

    while (tmp.firstChild) {
      frag.appendChild(tmp.firstChild);
    }

    // Perform the embed
    if (container) {
      // Prefer the container
      container.appendChild(frag);
    } else {
      // Use the reference element if no container given
      ref.parentNode.insertBefore(frag, ref);
    }

    // Stop timing fizzy rendering
    timerEnd(id, TIME_FIELDS.RENDER_PROCESS);

    // Call labJS to load or execute any scripts
    lab.runQueue();
  }

  /**
   * Get a content from a content container or the payload cache for an embed.
   */
  function getContent(id, parse, skipUnescape) {
    var innerContent, contentElem, innerLen, errMsg;

    // Start timing for the parseProcessing event
    timerStart(id, TIME_FIELDS.PARSE_PROCESS);

    // Get the container for the data string
    contentElem = document.getElementById(id + CONTENT_SUFFIX);

    if (!contentElem) {
      // Check the payload cache
      innerContent = fs.payload(id);

      if (!innerContent) {
        errMsg = 'Payload content for reference ID \'' + id +
                 '\' not found in the DOM or the cache.';
        log.warn(errMsg);
        emitError({ id: id, code: ERR_CODES.payloadCacheMiss, message: errMsg });
      }
    } else {
      // Make sure there is a comment element in here
      if (!contentElem.firstChild || contentElem.firstChild.nodeType !== 8) {
        errMsg = 'Payload content container for reference ID \'' + id + '\' was empty.';
        log.warn(errMsg);
        timerAbort(id, TIME_FIELDS.PARSE_PROCESS);
        emitError({ id: id, code: ERR_CODES.emptyPayloadNode, message: errMsg });
        return null;
      }

      innerContent = contentElem.firstChild.nodeValue;
      innerLen = innerContent.length;

      if (innerLen) {

        // For compatibility with older fizzyserver.so:
        // If not using new unicode escapes in json, always
        // unescape the presumably escaped contents
        if( !fs.isUniEscapeOn() ) {
          innerContent = fs.unescape(innerContent);
        } else {
          // If we're using the new escaping mechanism
          if( !parse ) {
            // This is not JSON, so unescape the HTML contents
            innerContent = fs.unescape(innerContent,false);
          } else {
            innerContent = fs.unescape(innerContent,true);
          }
        }

        // Clean up the content element since we've extracted it's contents at this point
        contentElem.parentNode.removeChild(contentElem);

        // End timing for the parseProcessing event
        timerEnd(id, TIME_FIELDS.PARSE_PROCESS);

        if (parse) {
          // The inner contents should be valid JSON
          innerContent = parseJSON(id, innerContent);
        }
      } else {
        // No innerContent found, string was empty
        log.warn('Payload content container for reference ID \'', id,
                 '\' had no content. You may not see any data for it\'s associated embed.');
        timerAbort(id, TIME_FIELDS.PARSE_PROCESS);
      }
    }

    return innerContent;
  }

  /**
   * Convenience for parsing a JSON string and logging if an issue occurs
   */
  function parseJSON(id, s) {
    var ret;

    // Append to the parseProcessing event
    timerStart(id, TIME_FIELDS.PARSE_PROCESS);

    // Check if the throw clause is in the JSON
    if (s.indexOf('throw /*LI:DBE*/ 1;') === 0) {
      // Strip it
      s = s.substring(19);
    }

    timerEnd(id, TIME_FIELDS.PARSE_PROCESS);

    try {
      timerStart(id, TIME_FIELDS.PARSE);
      ret = JSON.parse(s);
      timerEnd(id, TIME_FIELDS.PARSE);
    } catch (e) {
      if (!e.message) {
        e.message = 'Malformed JSON encountered during parse';
      }

      log.warn(e.message);
      timerAbort(id, TIME_FIELDS.PARSE);
      emitError({ id: id, code: ERR_CODES.jsonParse, message: e.message, thrown: e });
      throw e;
    }

    return ret;
  }

  /**
   * Check if the given string is wrapped in the format of the given comment object
   */
  function isWrappedByComment(comment, str) {
    // Check the front and back of the string to see if they are consistently formatted
    return str.substring(0, comment.start.length) === comment.start &&
      str.substring(str.length - comment.end.length) === comment.end;
  }

  /**
   * Merge two objects
   */
  function merge(to, from, overwrite, recursive) {
     var k;

     for (k in from) {
       if (from.hasOwnProperty(k)) {
         if (recursive && to.hasOwnProperty(k)) {
           // If they are both objects
           if (((from[k]+'') === OBJECT_STR) && ((to[k]+'') === OBJECT_STR)) {
             // Recurse
             to[k] = merge(to[k], from[k], overwrite, true);
             continue;
           }
         }

         if (!to.hasOwnProperty(k) || overwrite) {
           to[k] = from[k];
         }
       }
     }

     return to;
  }

  /**
   * Clone an object and return it
   */
  function clone(o, recursive) {
    var k, ret = {};

    for (k in o) {
      if (o.hasOwnProperty(k)) {
        // If we want to make a deep clone and the current member is another object
        if (recursive && ((o[k]+'') === OBJECT_STR)) {
          ret[k] = clone(o[k], true);
          continue;
        }

        ret[k] = o[k];
      }
    }

    return ret;
  }

  /**
   * Convert an Array-like object (NodeList, for example) to a true Array object
   */
  function toArray(items) {
    var item, i = 0, arr = [];

    while ((item = items[i++])) {
      arr.push(item);
    }

    return arr;
  }

  /**
   * Check if the current page is debug enabled based on query parameters.
   */
  function isDebug(query) {
    var parts = query.split(AMP), i = 0, pair, key;

    // Clear up the question mark
    parts[0] = parts[0].replace(Q, '');

    while ((pair = parts[i++])) {
      if (pair.indexOf(EQ) === -1) {
        key = pair;
      } else {
        key = pair.split(EQ)[0];
      }

      if (key === DBG_PARAM) {
        return true;
      }
    }

    return false;
  }

  /**
   * Register a callback to listen for a particular event fired by an embed.
   */
  function listen(eventName, id, callback, bubbleError) {
    // Create a placeholder Embeddable if there is an attempt to listen before the template or
    // HTML is even rendered into the DOM
    var embeddable = embeddables[id] || new Embeddable({ id: id }),
        event = embeddable.events[eventName],
        maxCount, tense, parts;

    if (!event) {
      parts = eventName.split(':');
      eventName = parts[0];

      parts = /(\w+)(?:\((\d+|\*)\))?/.exec(parts[1]);
      tense = parts[1];
      maxCount = parts[2];
      maxCount = (maxCount === '*') ? maxCount : parseInt(maxCount, 10);

      switch (tense) {
        case 'new':
          event = embeddable.newEvents[eventName];
          break;
        case 'any':
          event = embeddable.events[eventName];
          break;
        default:
          break;
      }
    } else {
      // Must be a standard event without any selector syntax, fire indefinitely
      maxCount = "*";
    }

    embeddables[id] = embeddable;
    event.listeners.push({
      count: 0, maxCount: maxCount, bubbleError: bubbleError, callback: callback
    });

    // If we've already fired off, immediately notify the new listener
    if (event.fired) {
      var o = {};
      o[LATE_KEY] = true;
      embeddable[eventName](o);
    }
  }

  /**
   * Unregister a callback from a list of listeners.
   */
  function popListener(listeners, callback) {
    var i, len;

    // Loop through listeners
    for (i = 0, len = listeners.length; i < len; i++) {
      // Check if the listener callbacks are the same
      if (listeners[i].callback === callback) {
        // Remove it from the array
        return listeners.splice(i, 1);
      }
    }
  }

  /**
   * Unregister a callback from an event.
   */
  function unlisten(eventName, id, callback) {
    var embed = embeddables[id], i = 0, j, ret, evtGroup, cbGroup;

    if (!embed) { return; }

    while ((evtGroup = EVENT_GROUPS[i++])) {
      j = 0;
      while ((cbGroup = CALLBACK_GROUPS[j++]) && !ret) {
        ret = popListener(embed[evtGroup][eventName][cbGroup], callback);
      }
    }

    return ret;
  }

  /**
   * Merge an Embeddable instance into an instance that derives from it (JsonEmbed, HtmlEmbed)
   */
  function mergeEmbeddable(embeddable, derivedEmbeddable) {
    // Check if the embeddable is a sub-class of Embeddable or something else
    if (embeddable.constructor !== Embeddable) {
      // Can't operate on this
      return;
    }

    for (var p in embeddable) {
      if (embeddable.hasOwnProperty(p)) {
        derivedEmbeddable[p] = embeddable[p];
      }
    }
  }

  /**
   * Get a custom object for rendering/fetching or register a listener to receive it lazily.
   *
   * @param {Object} o
   *    the options for this custom lazy invocation.
   *
   *    @param {String} opts.id
   *      the id of the embed.
   *
   *    @param {String} opts.customKey
   *      the key which will access the embed's CustomInvoke instance.
   *
   *    @param {String} opts.event
   *      the name of the event which may or may not have listeners bound.
   *
   *    @param {Function} opts.callback
   *      the function to call and provide the CustomInvoke instance, which can be invoked.
   *
   * @return {Object}
   *   the CustomInvoke instance, if it hasn't already been invoked. If it has, then undefined
   *   will be returned.
   */
  function lazyCustom(o) {
    if (!o.id) {
      return;
    }

    // Check if caller is attempting to use as a getter
    if (!o.callback) {
      // If we found a custom embed and it has not been invoked yet
      if (embeddables[o.id] && embeddables[o.id][o.customKey] &&
          !embeddables[o.id][o.customKey].invoked) {
        return embeddables[o.id][o.customKey];
      } else {
        // We didn't find an embed or the embed we found was already invoked
        log.warn('No custom embed found with id \'', o.id, '\', it may have already been ' +
                 'invoked or was never registered.');
        return;
      }
    } else {
      // Check if we've already invoked
      if (embeddables[o.id] && embeddables[o.id][o.customKey] &&
          !embeddables[o.id][o.customKey].invoked) {
        // Invoke the listener right away
        o.callback(o.id, embeddables[o.id][o.customKey]);
      } else {
        // We haven't invoked, register the callback as a listener for when that happens
        listen(o.event, o.id, o.callback);
      }
    }
  }

  /**
   * Unescape HTML entity representations for double and single quotes
   */
  function unescapeQuotes(str) {
    return str.replace(new RegExp('&quot;', ESC_FLAGS), '"')
              .replace(new RegExp('&squo;', ESC_FLAGS), '\'');
  }

  /**
   * Emit an 'error' event
   */
  function emitError(opts) {
    var global = embeddables[GLOBAL_EMBED_ID],
        individual = embeddables[opts.id],
        err = new ErrorEvent(opts);

    // Instantiate a cached embed so we can store the error in case of new listeners
    if (!global) {
      global = embeddables[GLOBAL_EMBED_ID] = new Embeddable({ id: GLOBAL_EMBED_ID });
    }

    if (!individual) {
      individual = embeddables[opts.id] = new Embeddable({ id: opts.id });
    }

    global.error(err);

    if (individual && (global !== individual)) {
      individual.error(err);
    }
  }

  /**
   * Provided with the 'error' event callback
   */
  function ErrorEvent(opts) {
    this.code = opts.code;

    // The embed ID associated with the error
    this.id = opts.id;

    // Message associated with the event that caused this error
    this.message = opts.message;

    // If an Error was thrown
    if (opts.thrown) {
      this.thrown = opts.thrown;
    }

    // Additional fields for XHR errors
    if (opts.xhrStatus || opts.xhrContentType) {
      this.xhr = {
        status: opts.xhrStatus,
        contentType: opts.xhrContentType
      };
    }
  }

  /**
   * Custom method invocation
   */
  function CustomInvoke(opts) {
    var self = this;

    self[opts.methodName] = function() {
      if (self.invoked) {
        return false;
      }

      self.invoked = true;
      opts.method.apply(window, opts.args);
      return true;
    };
  }

  /**
   * Base object for embeddable instances
   */
  function Embeddable(o) {
    if (!o) return;

    var self = this;

    self.id = o.id;
    self.events = {
      before: {name: 'before', fired: false, listeners: [], called: []},
      after: {name: 'after', fired: false, listeners: [], called: []},
      custom: {name: 'custom', fired: false, listeners: [], called: []},
      error: {name: 'error', fired: false, listeners: [], called: []},
      xhr: {name: 'xhr', fired: false, listeners: [], called: []},
      xhrCustom: {name: 'xhrCustom', fired: false, listeners: [], called: []}
    };

    self.newEvents = {
      after: {name:'after', listeners: [], called: []},
      before: {name: 'before', listeners: [], called: []},
      custom: {name: 'custom', listeners: [], called: []},
      error: {name: 'error', listeners: [], called: []},
      xhr: {name: 'xhr', listeners: [], called: []},
      xhrCustom: {name: 'xhrCustom', listeners: [], called: []}
    };

    if (o.xhrObj) {
      self.xhrObj = o.xhrObj;
    }

    if (o.args) {
      if (o.embedFunc) {
        self.initCustom(o);
      } else if (o.xhrFunc) {
        self.initCustomXHR(o);
      }
    }

    if (o.recordTimings || IS_DBG && !internalTime[o.id]) {
      self.recordTimings();
    }
  }

  /**
   * Initialize this embed for custom embed render control
   */
  Embeddable.prototype.initCustom = function(o) {
    this.customEmbed = new CustomInvoke({methodName: 'embed', method: o.embedFunc, args: o.args});
  };

  /**
   * Initialize this embed for custom embed fetch control
   */
  Embeddable.prototype.initCustomXHR = function(o) {
    this.customXHR = new CustomInvoke({methodName: 'xhr', method: o.xhrFunc, args: o.args});
  };

  /**
   * Enable timing recording for this embed
   */
  Embeddable.prototype.recordTimings = function() {
    // Timings start off at 0 initially
    this.timings = {
      parseProcessing: 0,
      parse: 0,
      renderProcessing: 0,
      render: 0,
      scriptExternalEval: 0,
      scriptInlineEval: 0,
      afterQueueProcessing: 0,
      beforeQueueProcessing: 0,
      total: 0
    };

    // Called with the timing data as an argument when timings are done
    this.timingCallback = undefined;

    // Internal timing for reading and writing timestamps
    internalTime[this.id] = {
      parseProcessing: { total: 0, fragmentStart: 0 },
      parse: { total: 0, fragmentStart: 0 },
      renderProcessing: { total: 0, fragmentStart: 0 },
      render: { total: 0, fragmentStart: 0 },
      scriptExternalEval: { total: 0, fragmentStart: 0 },
      scriptInlineEval: { total: 0, fragmentStart: 0 },
      afterQueueProcessing: { total: 0, fragmentStart: 0},
      beforeQueueProcessing: { total: 0, fragmentStart: 0},
      total: { total: 0, fragmentStart: 0 }
    };

    this.scriptExternalEval = false;
    this.timingComplete = false;
  };

  /**
   * Fire an event before or after a render occurs
   */
  Embeddable.prototype.fire = function(event, args, newEvt) {
    var o, argz, late;

    if (args.length && args[0] && args[0].hasOwnProperty(LATE_KEY)) {
      // Late event registration
      late = args[0][LATE_KEY];
      _splice.call(args, 0, 1);
    } else if (event.called.length) {
      // Fresh event, requeue all persistent listeners
      _push.apply(event.listeners, event.called);
      event.called = [];
    }

    if (event.listeners.length) {
      argz = this.id !== GLOBAL_EMBED_ID ? [this.id] : [];

      // Add any arguments
      _push.apply(argz, args);

      while ((o = event.listeners.shift())) {
        try {
          o.callback.apply(window, argz);

          if (o.maxCount && !isNaN(o.maxCount))
            o.maxCount--;

          // Global listeners must be removed manually
          if (this.id === GLOBAL_EMBED_ID || o.maxCount) {
            // This guarantees that this callback will continuously be called but only once for
            // each new broadcasting of this particular event
            event.called.push(o);
          }
        } catch (e) {
          log.warn('Callback ', (o.callback ? o.callback : '[no callback given]') + ' ',
                   'threw error \'', e , '\'');

          // If the registered listener wants to bubble any errors then let them bubble
          if (o.bubbleError) {
            throw e;
          }
        }
      }
    }

    // If this is not a new event
    if (!newEvt) {
      event.fired = true;

      if (!late) {
        this.fire(this.newEvents[event.name], args, 1);
      }
    }
  };

  /**
   * Notifies a set of listeners that this Embeddable has been embedded
   */
  Embeddable.prototype.after = function() {
    var args, argsLen, newArgs, globalEmbed, i;

    timerStart(this.id, TIME_FIELDS.AFTER_QUEUE_PROCESS);

    args = _slice.call(arguments, 0);
    args.push(this.context);
    this.fire.call(this, this.events.after, args);

    if (embeddables[GLOBAL_EMBED_ID]) {
      globalEmbed = embeddables[GLOBAL_EMBED_ID];
      newArgs = [this.id];
      argsLen = args.length;

      for (i = 0; i < argsLen; i++) {
        if (i === argsLen - 1) {
          args[i].events = this.events;
        }

        newArgs.push(args[i]);
      }

      globalEmbed.fire.call(globalEmbed, globalEmbed.events.after, newArgs);
    }

    timerEnd(this.id, TIME_FIELDS.AFTER_QUEUE_PROCESS);
  };

  /**
   * Notifies a set of listeners that this Embeddable is about to be embedded
   */
  Embeddable.prototype.before = function() {
    var args;

    timerStart(this.id, TIME_FIELDS.BEFORE_QUEUE_PROCESS);

    args = _slice.call(arguments, 0);
    args.push(this.context);
    this.fire.call(this, this.events.before, args);

    timerEnd(this.id, TIME_FIELDS.BEFORE_QUEUE_PROCESS);
  };

  /**
   * Notifies a set of listeners that this Embeddable had an error occur
   */
  Embeddable.prototype.error = function() {
    var args = _slice.call(arguments, 0);

    if (args.length && args[0]) {
      if (args[0] instanceof ErrorEvent) {
        this.lastErr = args[0];
      } else if (args[0].hasOwnProperty(LATE_KEY)) {
        args.push(this.lastErr);
      }
    }

    this.fire.call(this, this.events.error, args);
  };

  /**
   * Notifies a set of listeners that this Embeddable's data has been received
   */
  Embeddable.prototype.custom = function() {
    var args = _slice.call(arguments, 0);
    args.push(this.customEmbed);
    this.fire.call(this, this.events.custom, args);
  };

  /**
   * Notifies a set of listeners that this Embeddable's XHR request has completed
   */
  Embeddable.prototype.xhr = function() {
    var args = _slice.call(arguments, 0);
    args.push(this.xhrObj);
    this.fire.call(this, this.events.xhr, args);
  };

  /**
   * Notifies a set of listeners that this Embeddable's XHR request is ready to be fired
   */
  Embeddable.prototype.xhrCustom = function() {
    var args = _slice.call(arguments, 0);
    args.push(this.customXHR);
    this.fire.call(this, this.events.xhrCustom, args);
  };

  /**
   * JsonEmbed abstraction (dust rendering)
   */
  function JsonEmbed(o) {
    if (!o) return;
    this.super_.call(this, o);
    this.templateId = o.templateId;
    this.context = o.context;
  }

  // JsonEmbed inherits Embeddable
  inherit(Embeddable, JsonEmbed);

  /**
   * HTML data abstraction
   */
  function HtmlEmbed(o) {
    if (!o) return;
    this.super_.call(this, o);
    this.context = o.context;
  }

  // HtmlEmbed inherits Embeddable
  inherit(Embeddable, HtmlEmbed);

  /**
   * Helper for prototypal inheritance
   */
  function inherit(Parent, Child) {
    var F = function(){};
    F.prototype = Parent.prototype;
    Child.prototype = new F();
    Child.prototype.constructor = Child;
    Child.prototype.super_ = Parent;
  }

}(window.fs, window.document, window.$LAB));
