/**
 * UI dust helpers for use on all dust pages and embeds
 *
 */
(function() {

/**
 * Used in conjunction with miniprofile.js to create a Popup with a user's profile information. Ported from global.tmpl
 * @method miniprofile_popup
 * @param {Object} params a configuration object created from attributes set in the template.
 */
dust.helpers.miniprofile_popup = function(chunk, context, bodies, params){
    var url,
        tracking,
        getJs,
        className,
        template;

    if( params && params.url){
        url = dust.helpers.tap(params.url, chunk, context);
        tracking = params.tracking || '';
        className = dust.helpers.tap(params.searchClass, chunk, context) || '';
        getJs = dust.helpers.tap(params.getJs, chunk, context) || '';
        template = dust.helpers.tap(params.template, chunk, context) || '';

        chunk.write("<span data-tracking='" + tracking + "'");
        if (className) {
          chunk.write(" class='" + className + " " + url + "'");
        } else {
          chunk.write(" class='miniprofile-container " + url + "'");
        }
        if (url) {
          chunk.write(" data-li-url='" + url + "'");
        }
        if (getJs) {
          chunk.write(" data-li-getjs='" + getJs + "'");
        }
        if (template) {
          chunk.write(" data-li-tl='" + template + "'");
        }
        chunk.write("><strong>" );
        chunk.render( bodies.block, context);
        chunk.write("</strong></span>");
    }
    return chunk;
};

/**
 * Used to standardize HTML containers. Ported from shared.tmpl
 * @method module
 * @param {Object} params a configuration object created from attributes set in the template - see below for details.
 */
dust.helpers.module = function(chunk, context, bodies, params){
      var hasHdr,hdrTag,id,modClass,modType,title;
      if( params ){
          hasHdr = (typeof params.hasHdr === 'undefined' || params.hasHdr.toLowerCase() === 'true');
          hdrTag = params.hdrTag || 'h3';
          id = params.id || 'module-id'+Math.floor(Math.random()*1001);
          modClass = (params.moduleClass) ? ' ' + params.moduleClass : '';
          modType = params.type || 'util';
          title = dust.helpers.tap(params.title, chunk, context) || '';

          chunk.write("<div class='leo-module mod-" + modType + modClass +"' id='" + id + "'>");
          if( hasHdr ){
            chunk.write("<div class='header'><" + hdrTag + ">" + title + "</" + hdrTag + "></div>");
          }
          chunk.write("<div class='content'>");
          chunk.render( bodies.block, context);
          chunk.write("</div></div>");
      }
      return chunk;
};

/**
 * Opens a popup window with the help of LI.popup()
 * @method popup
 * @param {Object} params a configuration object created from attributes set in the template - see below for details.
 */
dust.helpers.popup = function(chunk, context, bodies, params){
    var displayClass,config,title,url;
    if( params && params.href ){
      config = params.config || "{}";
      displayClass = params.displayClass || "";
      title = dust.helpers.tap(params.title, chunk, context) || "";
      url = dust.helpers.tap(params.href, chunk, context);
      chunk.write("<a href='" + url + "' class='" + displayClass + "' onclick=\"LI.popup('" + url  + "', " + config + "); return false;\" title='" + title + "'>");
      if( bodies.block ){
          chunk.render( bodies.block );
      }else{
          chunk.write(" ");//possibly self closing tag. add empty space to support styling.
      }
      chunk.write("</a>");
    }
   return chunk;
};


var jscontrol = {};
jscontrol.count = 1;
//a registry of js control init/bootstrap instances
jscontrol.controls = {};

/**
 * helper to init and render the js control related scripts
 * @method jsControl
 * @param {Object} params a configuration object created from attributes set in the template.
 */
dust.helpers.jsControl = function(chunk, context, bodies, params){
    if( params && params.name ){
        var controlId = 'control-dust-' + jscontrol.count;
        var controlName = params.name;
        if(jscontrol.controls[controlName] !== 'initialized' &&
           params.disableControlInitData === undefined){
           jscontrol.controls[controlName] = "initialized";
           var controlPartial = "tl/shared/js-control/" + controlName.toLowerCase();
           // test if the partial is in the dust cache
           if (dust.cache[controlPartial]) {
             chunk.partial(controlPartial, context);
           }
        }
        chunk.write("<script id='" + controlId + "' type='linkedin/control' class='li-control'>");
        chunk.write("LI.Controls.addControl('" + controlId + "', '" + params.name + "', ");
        if( bodies.block ){
            chunk.render(bodies.block, context);
        }else{//assume its a self closing tag w/no config
            chunk.write("{}");
        }
        chunk.write(")</script>");
     jscontrol.count++;
    }
    return chunk;
};

/**
 * helper for including re-usable shared partials such as degree icon, miniprofile and ads
 * @method partial
 * @param {Object} params a configuration object created from attributes set in the template.
 * template param specifies the partial template to be rendered --optional
 * key params specifies the special context for the partial tag data --optional, defaults to creating tag data in partial block
 */
dust.helpers.partial = function( chunk, context, bodies, params ){
	var partial = {};
	if( params) {
	 var partialTagContext = params.key ? params.key : "partial" ;
	  for(var param in params) {
    	if(param !== 'key') {
	     partial[param] = params[param];
    	}
	  }
	}
	// append pre tag data
	var partialTagData = context.get(partialTagContext);
	if(partialTagData){
	  for(var data in partialTagData){
	 	 partial[data] = partialTagData[data];
	 }
	}
	partial.isPartial= true;

  // before rendering creates new context using makeBase
  if(params && params.template) {//use the name arg as the partial file to render
    // if there is a context, append it
    var template = params.template;
    // no override context
    if(template.indexOf(":") == -1) {
      return chunk.partial(template, dust.makeBase(partial));
    }
    else {
      var contextIndex = template.indexOf(":");
      var overrideContext = template.substring(parseInt(contextIndex + 1));
      template = template.substring(0, parseInt(contextIndex));
      var partialOverrideContext = context.get(overrideContext);
      if(partialOverrideContext) {
        for(var data in partialOverrideContext) {
          partial[data] = partialOverrideContext[data];
        }
      }
      return chunk.partial(template, dust.makeBase(partial));
    }
  }
  else {
    return bodies.block(chunk, dust.makeBase(partial));
  }
};


/**
 * helper works only with the partial, no body at this point
 * provides defaults to key params used in partial helper
 * @method param
 * @param {Object} params a configuration object created from attributes set in the template.
 */
dust.helpers.param = function( chunk, context, bodies, params ){
	if(context.global.isPartial){
	 if(params){
     var key = params.key,
         defaultVal = params.defaultVal,
         pKeyValue = context.global[key];
	  if(key && !pKeyValue && defaultVal){
	   context.global[key] = defaultVal;
	  }
	 }
	}
  return chunk;
};

/**
 * helper for console.log
 *
 */
dust.helpers.log = function(chunk, context, bodies, params){
   if( params && params.info && console ){
     console.log( 'log:',params.info );
   }
 return chunk;
};

})();
