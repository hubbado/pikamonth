/*!
 * Pikamonth
 *
 * This is slightly modified version of David Bushell's pickaday, which is limited to month selection rather than full
 * date selection.
 */

(function (root, factory)
{
  'use strict';

  var moment;
  if (typeof exports === 'object') {
    // CommonJS module
    // Load moment.js as an optional dependency
    try { moment = require('moment'); } catch (e) {}
    module.exports = factory(moment);
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(function (req)
    {
      // Load moment.js as an optional dependency
      var id = 'moment';
      try { moment = req(id); } catch (e) {}
      return factory(moment);
    });
  } else {
    root.Pikamonth = factory(root.moment);
  }
}(this, function (moment)
{
  'use strict';

  /**
   * feature detection and helper functions
   */
  var hasMoment = typeof moment === 'function',

    hasEventListeners = !!window.addEventListener,

    document = window.document,

    sto = window.setTimeout,

    addEvent = function(el, e, callback, capture)
    {
      if (hasEventListeners) {
        el.addEventListener(e, callback, !!capture);
      } else {
        el.attachEvent('on' + e, callback);
      }
    },

    removeEvent = function(el, e, callback, capture)
    {
      if (hasEventListeners) {
        el.removeEventListener(e, callback, !!capture);
      } else {
        el.detachEvent('on' + e, callback);
      }
    },

    fireEvent = function(el, eventName, data)
    {
      var ev;

      if (document.createEvent) {
        ev = document.createEvent('HTMLEvents');
        ev.initEvent(eventName, true, false);
        ev = extend(ev, data);
        el.dispatchEvent(ev);
      } else if (document.createEventObject) {
        ev = document.createEventObject();
        ev = extend(ev, data);
        el.fireEvent('on' + eventName, ev);
      }
    },

    trim = function(str)
    {
      return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g,'');
    },

    hasClass = function(el, cn)
    {
      return (' ' + el.className + ' ').indexOf(' ' + cn + ' ') !== -1;
    },

    addClass = function(el, cn)
    {
      if (!hasClass(el, cn)) {
        el.className = (el.className === '') ? cn : el.className + ' ' + cn;
      }
    },

    removeClass = function(el, cn)
    {
      el.className = trim((' ' + el.className + ' ').replace(' ' + cn + ' ', ' '));
    },

    isArray = function(obj)
    {
      return (/Array/).test(Object.prototype.toString.call(obj));
    },

    isDate = function(obj)
    {
      return (/Date/).test(Object.prototype.toString.call(obj)) && !isNaN(obj.getTime());
    },

    compareMonths = function(a,b)
    {
      return a.getYear() === b.getYear() && a.getMonth() === b.getMonth();
    },

    setToStartOfDay = function(date)
    {
      if (isDate(date)) date.setHours(0,0,0,0);
    },

    extend = function(to, from, overwrite)
    {
      var prop, hasProp;
      for (prop in from) {
        hasProp = to[prop] !== undefined;
        if (hasProp && typeof from[prop] === 'object' && from[prop] !== null && from[prop].nodeName === undefined) {
          if (isDate(from[prop])) {
            if (overwrite) {
              to[prop] = new Date(from[prop].getTime());
            }
          }
          else if (isArray(from[prop])) {
            if (overwrite) {
              to[prop] = from[prop].slice(0);
            }
          } else {
            to[prop] = extend({}, from[prop], overwrite);
          }
        } else if (overwrite || !hasProp) {
          to[prop] = from[prop];
        }
      }
      return to;
    },

    adjustCalendar = function(calendar) {
      if (calendar.month < 0) {
        calendar.year -= Math.ceil(Math.abs(calendar.month)/12);
        calendar.month += 12;
      }
      if (calendar.month > 11) {
        calendar.year += Math.floor(Math.abs(calendar.month)/12);
        calendar.month -= 12;
      }
      return calendar;
    },

    /**
     * defaults and localisation
     */
    defaults = {

      // bind the picker to a form field
      field: null,

      // automatically show/hide the picker on `field` focus (default `true` if `field` is set)
      bound: undefined,

      // position of the datepicker, relative to the field (default to bottom & left)
      // ('bottom' & 'left' keywords are not used, 'top' & 'right' are modifier on the bottom/left position)
      position: 'bottom left',

      // automatically fit in the viewport even if it means repositioning from the position option
      reposition: true,

      // the default output format for `.toString()` and `field` value
      format: 'YYYY-MM-DD',

      // the initial date to view when first opened
      defaultDate: null,

      // make the `defaultDate` the initial selected value
      setDefaultDate: false,

      // first day of week (0: Sunday, 1: Monday etc)
      firstDay: 0,

      // the minimum/earliest date that can be selected
      minDate: null,
      // the maximum/latest date that can be selected
      maxDate: null,

      // number of years either side, or array of upper/lower range
      yearRange: 10,

      // show week numbers at head of row
      showWeekNumber: false,

      // used internally (don't config outside)
      minYear: 0,
      maxYear: 9999,
      minMonth: undefined,
      maxMonth: undefined,

      startRange: null,
      endRange: null,

      isRTL: false,

      // Additional text to append to the year in the calendar title
      yearSuffix: '',

      // Render the month after year in the calendar title
      showMonthAfterYear: false,

      // how many months are visible
      numberOfMonths: 1,

      // when numberOfMonths is used, this will help you to choose where the main calendar will be (default `left`, can be set to `right`)
      // only used for the first display or when a selected date is not visible
      mainCalendar: 'left',

      // Specify a DOM element to render the calendar in
      container: undefined,

      // internationalization
      i18n: {
        previousMonth : 'Previous Month',
        nextMonth     : 'Next Month',
        months        : ['January','February','March','April','May','June','July','August','September','October','November','December'],
        monthsShort   : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Ocr', 'Nov', 'Dec']
      },

      // Theme Classname
      theme: null,

      // callback function
      onSelect: null,
      onOpen: null,
      onClose: null,
      onDraw: null
    },


    /**
     * templating functions to abstract HTML rendering
     */

    renderMonths = function(instance, from, to, year)
    {
      var html = '<div class="pika-months-list">',
          opts = instance._o,
          isSelected, day;
      for (var i = from; i <= to; i++) {
        day = new Date(year, i, 1);
        isSelected = isDate(instance._d) ? compareMonths(day, instance._d) : false;
        var selectedClass = isSelected ? ' is-selected' : '';
        html += '<div class="month pika-button' + selectedClass + '" data-pika-month="' + i + '" data-pika-day="1" data-pika-year="' + year + '">' + opts.i18n.monthsShort[i] + '</div>';
      }
      return html + '</div>';
    },

    renderTitle = function(instance, c, year)
    {
      var i, j, arr,
        opts = instance._o,
        isMinYear = year === opts.minYear,
        isMaxYear = year === opts.maxYear,
        html = '<div class="pika-title">',
        yearHtml,
        prev = true,
        next = true;

      if (isArray(opts.yearRange)) {
        i = opts.yearRange[0];
        j = opts.yearRange[1] + 1;
      } else {
        i = year - opts.yearRange;
        j = 1 + year + opts.yearRange;
      }

      for (arr = []; i < j && i <= opts.maxYear; i++) {
        if (i >= opts.minYear) {
          arr.push('<option value="' + i + '"' + (i === year ? ' selected': '') + '>' + (i) + '</option>');
        }
      }

      yearHtml = '<div class="pika-label">' + year + opts.yearSuffix + '<select class="pika-select pika-select-year" tabindex="-1">' + arr.join('') + '</select></div>';
      html += yearHtml;

      if (isMinYear) {
        prev = false;
      }

      if (isMaxYear) {
        next = false;
      }

      if (c === 0) {
        html += '<button class="pika-prev' + (prev ? '' : ' is-disabled') + '" type="button">' + opts.i18n.previousMonth + '</button>';
      }
      if (c === (instance._o.numberOfMonths - 1) ) {
        html += '<button class="pika-next' + (next ? '' : ' is-disabled') + '" type="button">' + opts.i18n.nextMonth + '</button>';
      }

      return html += '</div>';
    },


    /**
     * Pikamonth constructor
     */
    Pikamonth = function(options)
    {
      var self = this,
        opts = self.config(options);

      self._onMouseDown = function(e)
      {
        if (!self._v) {
          return;
        }
        e = e || window.event;
        var target = e.target || e.srcElement;
        if (!target) {
          return;
        }

        if (!hasClass(target, 'is-disabled')) {
          if (hasClass(target, 'pika-button') && !hasClass(target, 'is-empty')) {
            self.setDate(new Date(target.getAttribute('data-pika-year'), target.getAttribute('data-pika-month'), target.getAttribute('data-pika-day')));
            if (opts.bound) {
              sto(function() {
                self.hide();
                if (opts.field) {
                  opts.field.blur();
                }
              }, 100);
            }
          }
          else if (hasClass(target, 'pika-prev')) {
            self.prevYear();
          }
          else if (hasClass(target, 'pika-next')) {
            self.nextYear();
          }
        }
        if (!hasClass(target, 'pika-select')) {
          // if this is touch event prevent mouse events emulation
          if (e.preventDefault) {
            e.preventDefault();
          } else {
            e.returnValue = false;
            return false;
          }
        } else {
          self._c = true;
        }
      };

      self._onChange = function(e)
      {
        e = e || window.event;
        var target = e.target || e.srcElement;
        if (!target) {
          return;
        }
        if (hasClass(target, 'pika-select-month')) {
          self.gotoMonth(target.value);
        }
        else if (hasClass(target, 'pika-select-year')) {
          self.gotoYear(target.value);
        }
      };

      self._onInputChange = function(e)
      {
        var date;

        if (e.firedBy === self) {
          return;
        }
        if (hasMoment) {
          date = moment(opts.field.value, opts.format);
          date = (date && date.isValid()) ? date.toDate() : null;
        }
        else {
          date = new Date(Date.parse(opts.field.value));
        }
        if (isDate(date)) {
          self.setDate(date);
        }
        if (!self._v) {
          self.show();
        }
      };

      self._onInputFocus = function()
      {
        self.show();
      };

      self._onInputClick = function()
      {
        self.show();
      };

      self._onInputBlur = function()
      {
        // IE allows pika div to gain focus; catch blur the input field
        var pEl = document.activeElement;
        do {
          if (hasClass(pEl, 'pika-single')) {
            return;
          }
        }
        while ((pEl = pEl.parentNode));

        if (!self._c) {
          self._b = sto(function() {
            self.hide();
          }, 50);
        }
        self._c = false;
      };

      self._onClick = function(e)
      {
        e = e || window.event;
        var target = e.target || e.srcElement,
          pEl = target;
        if (!target) {
          return;
        }
        if (!hasEventListeners && hasClass(target, 'pika-select')) {
          if (!target.onchange) {
            target.setAttribute('onchange', 'return;');
            addEvent(target, 'change', self._onChange);
          }
        }
        do {
          if (hasClass(pEl, 'pika-single') || pEl === opts.trigger) {
            return;
          }
        }
        while ((pEl = pEl.parentNode));
        if (self._v && target !== opts.trigger && pEl !== opts.trigger) {
          self.hide();
        }
      };

      self.el = document.createElement('div');
      self.el.className = 'pika-single' + (opts.isRTL ? ' is-rtl' : '') + (opts.theme ? ' ' + opts.theme : '');

      addEvent(self.el, 'mousedown', self._onMouseDown, true);
      addEvent(self.el, 'touchend', self._onMouseDown, true);
      addEvent(self.el, 'change', self._onChange);

      if (opts.field) {
        if (opts.container) {
          opts.container.appendChild(self.el);
        } else if (opts.bound) {
          document.body.appendChild(self.el);
        } else {
          opts.field.parentNode.insertBefore(self.el, opts.field.nextSibling);
        }
        addEvent(opts.field, 'change', self._onInputChange);

        if (!opts.defaultDate) {
          if (hasMoment && opts.field.value) {
            opts.defaultDate = moment(opts.field.value, opts.format).toDate();
          } else {
            opts.defaultDate = new Date(Date.parse(opts.field.value));
          }
          opts.setDefaultDate = true;
        }
      }

      var defDate = opts.defaultDate;

      if (isDate(defDate)) {
        if (opts.setDefaultDate) {
          self.setDate(defDate, true);
        } else {
          self.gotoDate(defDate);
        }
      } else {
        self.gotoDate(new Date());
      }

      if (opts.bound) {
        this.hide();
        self.el.className += ' is-bound';
        addEvent(opts.trigger, 'click', self._onInputClick);
        addEvent(opts.trigger, 'focus', self._onInputFocus);
        addEvent(opts.trigger, 'blur', self._onInputBlur);
      } else {
        this.show();
      }
    };


  /**
   * public Pikamonth API
   */
  Pikamonth.prototype = {


    /**
     * configure functionality
     */
    config: function(options)
    {
      if (!this._o) {
        this._o = extend({}, defaults, true);
      }

      var opts = extend(this._o, options, true);

      opts.isRTL = !!opts.isRTL;

      opts.field = (opts.field && opts.field.nodeName) ? opts.field : null;

      opts.theme = (typeof opts.theme) === 'string' && opts.theme ? opts.theme : null;

      opts.bound = !!(opts.bound !== undefined ? opts.field && opts.bound : opts.field);

      opts.trigger = (opts.trigger && opts.trigger.nodeName) ? opts.trigger : opts.field;

      opts.disableWeekends = !!opts.disableWeekends;

      opts.disableDayFn = (typeof opts.disableDayFn) === 'function' ? opts.disableDayFn : null;

      var nom = parseInt(opts.numberOfMonths, 10) || 1;
      opts.numberOfMonths = nom > 4 ? 4 : nom;

      if (!isDate(opts.minDate)) {
        opts.minDate = false;
      }
      if (!isDate(opts.maxDate)) {
        opts.maxDate = false;
      }
      if ((opts.minDate && opts.maxDate) && opts.maxDate < opts.minDate) {
        opts.maxDate = opts.minDate = false;
      }
      if (opts.minDate) {
        this.setMinDate(opts.minDate);
      }
      if (opts.maxDate) {
        this.setMaxDate(opts.maxDate);
      }

      if (isArray(opts.yearRange)) {
        var fallback = new Date().getFullYear() - 10;
        opts.yearRange[0] = parseInt(opts.yearRange[0], 10) || fallback;
        opts.yearRange[1] = parseInt(opts.yearRange[1], 10) || fallback;
      } else {
        opts.yearRange = Math.abs(parseInt(opts.yearRange, 10)) || defaults.yearRange;
        if (opts.yearRange > 100) {
          opts.yearRange = 100;
        }
      }

      return opts;
    },

    /**
     * return a formatted string of the current selection (using Moment.js if available)
     */
    toString: function(format)
    {
      return !isDate(this._d) ? '' : hasMoment ? moment(this._d).format(format || this._o.format) : this._d.toDateString();
    },

    /**
     * return a Moment.js object of the current selection (if available)
     */
    getMoment: function()
    {
      return hasMoment ? moment(this._d) : null;
    },

    /**
     * set the current selection from a Moment.js object (if available)
     */
    setMoment: function(date, preventOnSelect)
    {
      if (hasMoment && moment.isMoment(date)) {
        this.setDate(date.toDate(), preventOnSelect);
      }
    },

    /**
     * return a Date object of the current selection
     */
    getDate: function()
    {
      return isDate(this._d) ? new Date(this._d.getTime()) : null;
    },

    /**
     * set the current selection
     */
    setDate: function(date, preventOnSelect)
    {
      if (!date) {
        this._d = null;

        if (this._o.field) {
          this._o.field.value = '';
          fireEvent(this._o.field, 'change', { firedBy: this });
        }

        return this.draw();
      }
      if (typeof date === 'string') {
        date = new Date(Date.parse(date));
      }
      if (!isDate(date)) {
        return;
      }

      var min = this._o.minDate,
        max = this._o.maxDate;

      if (isDate(min) && date < min) {
        date = min;
      } else if (isDate(max) && date > max) {
        date = max;
      }

      this._d = new Date(date.getTime());
      setToStartOfDay(this._d);
      this.gotoDate(this._d);

      if (this._o.field) {
        this._o.field.value = this.toString();
        fireEvent(this._o.field, 'change', { firedBy: this });
      }
      if (!preventOnSelect && typeof this._o.onSelect === 'function') {
        this._o.onSelect.call(this, this.getDate());
      }
    },

    /**
     * change view to a specific date
     */
    gotoDate: function(date)
    {
      var newCalendar = true;

      if (!isDate(date)) {
        return;
      }

      if (this.calendars) {
        var firstVisibleDate = new Date(this.calendars[0].year, this.calendars[0].month, 1),
          lastVisibleDate = new Date(this.calendars[this.calendars.length-1].year, this.calendars[this.calendars.length-1].month, 1),
          visibleDate = date.getTime();
        // get the end of the month
        lastVisibleDate.setMonth(lastVisibleDate.getMonth()+1);
        lastVisibleDate.setDate(lastVisibleDate.getDate()-1);
        newCalendar = (visibleDate < firstVisibleDate.getTime() || lastVisibleDate.getTime() < visibleDate);
      }

      if (newCalendar) {
        this.calendars = [{
          month: date.getMonth(),
          year: date.getFullYear()
        }];
        if (this._o.mainCalendar === 'right') {
          this.calendars[0].month += 1 - this._o.numberOfMonths;
        }
      }

      this.adjustCalendars();
    },

    adjustCalendars: function() {
      this.calendars[0] = adjustCalendar(this.calendars[0]);
      for (var c = 1; c < this._o.numberOfMonths; c++) {
        this.calendars[c] = adjustCalendar({
          month: this.calendars[0].month + c,
          year: this.calendars[0].year
        });
      }
      this.draw();
    },

    gotoToday: function()
    {
      this.gotoDate(new Date());
    },

    /**
     * change view to a specific month (zero-index, e.g. 0: January)
     */

    nextYear: function()
    {
      this.calendars[0].year++;
      this.adjustCalendars();
    },

    prevYear: function()
    {
      this.calendars[0].year--;
      this.adjustCalendars();
    },

    /**
     * change view to a specific full year (e.g. "2012")
     */
    gotoYear: function(year)
    {
      if (!isNaN(year)) {
        this.calendars[0].year = parseInt(year, 10);
        this.adjustCalendars();
      }
    },

    /**
     * change the minDate
     */
    setMinDate: function(value)
    {
      setToStartOfDay(value);
      this._o.minDate = value;
      this._o.minYear  = value.getFullYear();
      this._o.minMonth = value.getMonth();
      this.draw();
    },

    /**
     * change the maxDate
     */
    setMaxDate: function(value)
    {
      setToStartOfDay(value);
      this._o.maxDate = value;
      this._o.maxYear = value.getFullYear();
      this._o.maxMonth = value.getMonth();
      this.draw();
    },

    setStartRange: function(value)
    {
      this._o.startRange = value;
    },

    setEndRange: function(value)
    {
      this._o.endRange = value;
    },

    /**
     * refresh the HTML
     */
    draw: function(force)
    {
      if (!this._v && !force) {
        return;
      }
      var opts = this._o,
        minYear = opts.minYear,
        maxYear = opts.maxYear,
        minMonth = opts.minMonth,
        maxMonth = opts.maxMonth,
        html = '';

      if (this._y <= minYear) {
        this._y = minYear;
        if (!isNaN(minMonth) && this._m < minMonth) {
          this._m = minMonth;
        }
      }
      if (this._y >= maxYear) {
        this._y = maxYear;
        if (!isNaN(maxMonth) && this._m > maxMonth) {
          this._m = maxMonth;
        }
      }

      html += '<div class="pika-lendar">' + renderTitle(this, 0, this.calendars[0].year) + this.render(this.calendars[0].year, this.calendars[0].month) + '</div>';

      this.el.innerHTML = html;

      if (opts.bound) {
        if(opts.field.type !== 'hidden') {
          sto(function() {
            opts.trigger.focus();
          }, 1);
        }
      }

      if (typeof this._o.onDraw === 'function') {
        var self = this;
        sto(function() {
          self._o.onDraw.call(self);
        }, 0);
      }
    },

    adjustPosition: function()
    {
      var field, pEl, width, height, viewportWidth, viewportHeight, scrollTop, left, top, clientRect;

      if (this._o.container) return;

      this.el.style.position = 'absolute';

      field = this._o.trigger;
      pEl = field;
      width = this.el.offsetWidth;
      height = this.el.offsetHeight;
      viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      scrollTop = window.pageYOffset || document.body.scrollTop || document.documentElement.scrollTop;

      if (typeof field.getBoundingClientRect === 'function') {
        clientRect = field.getBoundingClientRect();
        left = clientRect.left + window.pageXOffset;
        top = clientRect.bottom + window.pageYOffset;
      } else {
        left = pEl.offsetLeft;
        top  = pEl.offsetTop + pEl.offsetHeight;
        while((pEl = pEl.offsetParent)) {
          left += pEl.offsetLeft;
          top  += pEl.offsetTop;
        }
      }

      // default position is bottom & left
      if ((this._o.reposition && left + width > viewportWidth) ||
        (
          this._o.position.indexOf('right') > -1 &&
          left - width + field.offsetWidth > 0
        )
      ) {
        left = left - width + field.offsetWidth;
      }
      if ((this._o.reposition && top + height > viewportHeight + scrollTop) ||
        (
          this._o.position.indexOf('top') > -1 &&
          top - height - field.offsetHeight > 0
        )
      ) {
        top = top - height - field.offsetHeight;
      }

      this.el.style.left = left + 'px';
      this.el.style.top = top + 'px';
    },

    /**
     * render HTML for a particular month
     */
    render: function(year)
    {
      return renderMonths(this, 0, 11, year);
    },

    isVisible: function()
    {
      return this._v;
    },

    show: function()
    {
      if (!this._v) {
        removeClass(this.el, 'is-hidden');
        this._v = true;
        this.draw();
        if (this._o.bound) {
          addEvent(document, 'click', this._onClick);
          this.adjustPosition();
        }
        if (typeof this._o.onOpen === 'function') {
          this._o.onOpen.call(this);
        }
      }
    },

    hide: function()
    {
      var v = this._v;
      if (v !== false) {
        if (this._o.bound) {
          removeEvent(document, 'click', this._onClick);
        }
        this.el.style.position = 'static'; // reset
        this.el.style.left = 'auto';
        this.el.style.top = 'auto';
        addClass(this.el, 'is-hidden');
        this._v = false;
        if (v !== undefined && typeof this._o.onClose === 'function') {
          this._o.onClose.call(this);
        }
      }
    },

    /**
     * GAME OVER
     */
    destroy: function()
    {
      this.hide();
      removeEvent(this.el, 'mousedown', this._onMouseDown, true);
      removeEvent(this.el, 'touchend', this._onMouseDown, true);
      removeEvent(this.el, 'change', this._onChange);
      if (this._o.field) {
        removeEvent(this._o.field, 'change', this._onInputChange);
        if (this._o.bound) {
          removeEvent(this._o.trigger, 'click', this._onInputClick);
          removeEvent(this._o.trigger, 'focus', this._onInputFocus);
          removeEvent(this._o.trigger, 'blur', this._onInputBlur);
        }
      }
      if (this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
    }

  };

  return Pikamonth;

}));
