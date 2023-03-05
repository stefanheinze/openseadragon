/*
 * OpenSeadragon - DrawerBase
 *
 * Copyright (C) 2009 CodePlex Foundation
 * Copyright (C) 2010-2023 OpenSeadragon contributors
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * - Redistributions of source code must retain the above copyright notice,
 *   this list of conditions and the following disclaimer.
 *
 * - Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in the
 *   documentation and/or other materials provided with the distribution.
 *
 * - Neither the name of CodePlex Foundation nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

(function( $ ){

/**
 * @class DrawerBase
 * @memberof OpenSeadragon
 * @classdesc Base class for Drawers that handle rendering of tiles for an {@link OpenSeadragon.Viewer}.
 * @param {Object} options - Options for this Drawer.
 * @param {OpenSeadragon.Viewer} options.viewer - The Viewer that owns this Drawer.
 * @param {OpenSeadragon.Viewport} options.viewport - Reference to Viewer viewport.
 * @param {Element} options.element - Parent element.
 */
$.DrawerBase = function( options ) {

    $.console.assert( options.viewer, "[Drawer] options.viewer is required" );

    //backward compatibility for positional args while preferring more
    //idiomatic javascript options object as the only argument
    var args  = arguments;

    if( !$.isPlainObject( options ) ){
        options = {
            source:     args[ 0 ], // Reference to Viewer tile source.
            viewport:   args[ 1 ], // Reference to Viewer viewport.
            element:    args[ 2 ]  // Parent element.
        };
    }

    $.console.assert( options.viewport, "[Drawer] options.viewport is required" );
    $.console.assert( options.element, "[Drawer] options.element is required" );

    if ( options.source ) {
        $.console.error( "[Drawer] options.source is no longer accepted; use TiledImage instead" );
    }

    this.viewer = options.viewer;
    this.viewport = options.viewport;
    this.debugGridColor = typeof options.debugGridColor === 'string' ? [options.debugGridColor] : options.debugGridColor || $.DEFAULT_SETTINGS.debugGridColor;

    if (options.opacity) {
        $.console.error( "[Drawer] options.opacity is no longer accepted; set the opacity on the TiledImage instead" );
    }

    this.useCanvas  = $.supportsCanvas && ( this.viewer ? this.viewer.useCanvas : true );
    /**
     * The parent element of this Drawer instance, passed in when the Drawer was created.
     * The parent of {@link OpenSeadragon.DrawerBase#canvas}.
     * @member {Element} container
     * @memberof OpenSeadragon.DrawerBase#
     */
    this.container  = $.getElement( options.element );
    /**
     * A &lt;canvas&gt; element if the browser supports them, otherwise a &lt;div&gt; element.
     * Child element of {@link OpenSeadragon.DrawerBase#container}.
     * @member {Element} canvas
     * @memberof OpenSeadragon.DrawerBase#
     */
    this.canvas     = $.makeNeutralElement( this.useCanvas ? "canvas" : "div" );


    /**
     * @member {Element} element
     * @memberof OpenSeadragon.DrawerBase#
     * @deprecated Alias for {@link OpenSeadragon.DrawerBase#container}.
     */
    this.element    = this.container;

    // We force our container to ltr because our drawing math doesn't work in rtl.
    // This issue only affects our canvas renderer, but we do it always for consistency.
    // Note that this means overlays you want to be rtl need to be explicitly set to rtl.
    this.container.dir = 'ltr';

    if (this.useCanvas) {
        var viewportSize = this._calculateCanvasSize();
        this.canvas.width = viewportSize.x;
        this.canvas.height = viewportSize.y;
    }

    this.canvas.style.width     = "100%";
    this.canvas.style.height    = "100%";
    this.canvas.style.position  = "absolute";
    $.setElementOpacity( this.canvas, this.opacity, true );

    // Allow pointer events to pass through the canvas element so implicit
    //   pointer capture works on touch devices
    $.setElementPointerEventsNone( this.canvas );
    $.setElementTouchActionNone( this.canvas );

    // explicit left-align
    this.container.style.textAlign = "left";
    this.container.appendChild( this.canvas );

    // Image smoothing for canvas rendering (only if canvas is used).
    // Canvas default is "true", so this will only be changed if user specified "false".
    this._imageSmoothingEnabled = true;

    this._checkForAPIOverrides();
};

/** @lends OpenSeadragon.DrawerBaseBase.prototype */
$.DrawerBase.prototype = {

    // Drawer implementaions must define the next four methods. These are called
    // by core OSD, and forcing overrides (even for nullop methods) makes the
    // behavior of the implementations explicitly clear in the code.
    // Whether these have been overridden by child classes is checked in the
    // constructor (via _checkForAPIOverrides). It could make sense to consolidate
    // these a bit (e.g. by making `draw` take an array of `TiledImage`s and
    // clearing the view as needed, rather than the existing pattern of
    // `drawer.clear(); world.draw()` in the calling code), but they have been
    // left as-is to maintain backwards compatibility.

    /**
     * @param tiledImage the TiledImage that is ready to be drawn
     */
    draw: function(tiledImage) {
        $.console.error('Drawer.draw must be implemented by child class');
    },

    /**
     * @returns {Boolean} True if rotation is supported.
     */
    canRotate: function() {
        $.console.error('Drawer.canRotate must be implemented by child class');
    },

    /**
     * Destroy the drawer (unload current loaded tiles)
     */
    destroy: function() {
        $.console.error('Drawer.destroy must be implemented by child class');
    },

    /**
     * Clears the Drawer so it's ready to draw another frame.
     */
    clear: function() {
        $.console.error('Drawer.clear must be implemented by child class');
    },

    /**
     * Turns image smoothing on or off for this viewer. Note: Ignored in some (especially older) browsers that do not support this property.
     *
     * @function
     * @param {Boolean} [imageSmoothingEnabled] - Whether or not the image is
     * drawn smoothly on the canvas; see imageSmoothingEnabled in
     * {@link OpenSeadragon.Options} for more explanation.
     */
    setImageSmoothingEnabled: function(imageSmoothingEnabled){
        $.console.error('Drawer.setImageSmoothingEnabled must be implemented by child class');
    },

    /**
     * Ensures that child classes have provided implementations for API methods
     * draw, canRotate, destroy, and clear. Throws an exception if the original
     * placeholder methods are still in place.
     */
    _checkForAPIOverrides: function(){
        if(this.draw === $.DrawerBase.prototype.draw){
            throw("[drawer].draw must be implemented by child class");
        }
        if(this.canRotate === $.DrawerBase.prototype.canRotate){
            throw("[drawer].canRotate must be implemented by child class");
        }
        if(this.destroy === $.DrawerBase.prototype.destroy){
            throw("[drawer].destroy must be implemented by child class");
        }
        if(this.clear === $.DrawerBase.prototype.clear){
            throw("[drawer].clear must be implemented by child class");
        }
        if(this.setImageSmoothingEnabled === $.DrawerBase.prototype.setImageSmoothingEnabled){
            throw("[drawer].setImageSmoothingEnabled must be implemented by child class");
        }
    },

    /**
     * Scale from OpenSeadragon viewer rectangle to drawer rectangle
     * (ignoring rotation)
     * @param {OpenSeadragon.Rect} rectangle - The rectangle in viewport coordinate system.
     * @returns {OpenSeadragon.Rect} Rectangle in drawer coordinate system.
     */
    viewportToDrawerRectangle: function(rectangle) {
        var topLeft = this.viewport.pixelFromPointNoRotate(rectangle.getTopLeft(), true);
        var size = this.viewport.deltaPixelsFromPointsNoRotate(rectangle.getSize(), true);

        return new $.Rect(
            topLeft.x * $.pixelDensityRatio,
            topLeft.y * $.pixelDensityRatio,
            size.x * $.pixelDensityRatio,
            size.y * $.pixelDensityRatio
        );
    },

    /**
     * This function converts the given point from to the drawer coordinate by
     * multiplying it with the pixel density.
     * This function does not take rotation into account, thus assuming provided
     * point is at 0 degree.
     * @param {OpenSeadragon.Point} point - the pixel point to convert
     * @returns {OpenSeadragon.Point} Point in drawer coordinate system.
     */
    viewportCoordToDrawerCoord: function(point) {
        var vpPoint = this.viewport.pixelFromPointNoRotate(point, true);
        return new $.Point(
            vpPoint.x * $.pixelDensityRatio,
            vpPoint.y * $.pixelDensityRatio
        );
    },


    // private
    _calculateCanvasSize: function() {
        var pixelDensityRatio = $.pixelDensityRatio;
        var viewportSize = this.viewport.getContainerSize();
        return {
            // canvas width and height are integers
            x: Math.round(viewportSize.x * pixelDensityRatio),
            y: Math.round(viewportSize.y * pixelDensityRatio)
        };
    },


    /* Deprecated Functions */

    // deprecated
    addOverlay: function( element, location, placement, onDraw ) {
        $.console.error("drawer.addOverlay is deprecated. Use viewer.addOverlay instead.");
        this.viewer.addOverlay( element, location, placement, onDraw );
        return this;
    },

    // deprecated
    updateOverlay: function( element, location, placement ) {
        $.console.error("drawer.updateOverlay is deprecated. Use viewer.updateOverlay instead.");
        this.viewer.updateOverlay( element, location, placement );
        return this;
    },

    // deprecated
    removeOverlay: function( element ) {
        $.console.error("drawer.removeOverlay is deprecated. Use viewer.removeOverlay instead.");
        this.viewer.removeOverlay( element );
        return this;
    },

    // deprecated
    clearOverlays: function() {
        $.console.error("drawer.clearOverlays is deprecated. Use viewer.clearOverlays instead.");
        this.viewer.clearOverlays();
        return this;
    },
    // deprecated
    needsUpdate: function() {
        $.console.error( "[Drawer.needsUpdate] this function is deprecated. Use World.needsDraw instead." );
        return this.viewer.world.needsDraw();
    },

    // deprecated
    numTilesLoaded: function() {
        $.console.error( "[Drawer.numTilesLoaded] this function is deprecated. Use TileCache.numTilesLoaded instead." );
        return this.viewer.tileCache.numTilesLoaded();
    },

    // deprecated
    reset: function() {
        $.console.error( "[Drawer.reset] this function is deprecated. Use World.resetItems instead." );
        this.viewer.world.resetItems();
        return this;
    },

    // deprecated
    update: function() {
        $.console.error( "[Drawer.update] this function is deprecated. Use Drawer.clear and World.draw instead." );
        this.clear();
        this.viewer.world.draw();
        return this;
    },

    // deprecated
    setOpacity: function( opacity ) {
        $.console.error("drawer.setOpacity is deprecated. Use tiledImage.setOpacity instead.");
        var world = this.viewer.world;
        for (var i = 0; i < world.getItemCount(); i++) {
            world.getItemAt( i ).setOpacity( opacity );
        }
        return this;
    },

    // deprecated
    getOpacity: function() {
        $.console.error("drawer.getOpacity is deprecated. Use tiledImage.getOpacity instead.");
        var world = this.viewer.world;
        var maxOpacity = 0;
        for (var i = 0; i < world.getItemCount(); i++) {
            var opacity = world.getItemAt( i ).getOpacity();
            if ( opacity > maxOpacity ) {
                maxOpacity = opacity;
            }
        }
        return maxOpacity;
    },
};

Object.defineProperty($.DrawerBase.prototype, "isOpenSeadragonDrawer", {
    get: function get() {
        return true;
    }
});


}( OpenSeadragon ));
