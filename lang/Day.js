const assert = require('./assert'),
	ComparatorBuilder = require('./../collections/sorting/ComparatorBuilder'),
	comparators = require('./../collections/sorting/comparators'),
	is = require('./is');

module.exports = (() => {
	'use strict';

	/**
	 * A data structure that represents a day (year, month, and day)
	 * without consideration for time or timezone.
	 *
	 * @public
	 */
	class Day {
		constructor(year, month, day) {
			if (!Day.validate(year, month, day)) {
				throw new Error(`Unable to instantiate Day, input is invalid [${year}], [${month}], [${day}]`);
			}

			this._year = year;
			this._month = month;
			this._day = day;
		}

		/**
		 * Calculates a new {@link Day} in the future (or past).
		 *
		 * @public
		 * @param {Number} days - The number of days to add (negative numbers can be used for subtraction).
		 * @param {Boolean=} inverse - If true, the sign of the "days" value will be flipped.
		 * @returns {Day}
		 */
		addDays(days, inverse) {
			assert.argumentIsRequired(days, 'days', Number);
			assert.argumentIsOptional(inverse, inverse, Boolean);
			assert.argumentIsValid(days, 'days', is.large, 'is an integer');

			let daysToAdd;

			if (inverse) {
				daysToAdd = daysToAdd * -1;
			}

			return new Day(this._year, this._month, this._day);
		}

		subtractDays(days) {
			return this.addDays(days, true);
		}

		/**
		 * The year.
		 *
		 * @public
		 * @returns {Number}
		 */
		get year() {
			return this._year;
		}

		/**
		 * The month of the year (January is one, December is twelve).
		 *
		 * @public
		 * @returns {*}
		 */
		get month() {
			return this._month;
		}

		/**
		 * The day of the month.
		 *
		 * @public
		 * @returns {Number}
		 */
		get day() {
			return this._day;
		}

		/**
		 * Outputs the date as the formatted string: {year}-{month}-{day}.
		 *
		 * @public
		 * @returns {String}
		 */
		format() {
			return `${this._year}-${leftPad(this._month)}-${leftPad(this._day)}`;
		}

		/**
		 * Returns the JSON representation.
		 *
		 * @public
		 * @returns {String}
		 */
		toJSON() {
			return this.format();
		}

		/**
		 * Converts a string (which matches the output of {@link Day#format} into
		 * a {@link Day} instance.
		 *
		 * @public
		 * @param {String} value
		 * @returns {Day}
		 */
		static parse(value) {
			assert.argumentIsRequired(value, 'value', String);

			const match = value.match(dayRegex);

			if (match === null) {
				throw new Error(`Unable to parse value as Day [ ${value} ]`);
			}

			return new Day(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
		}

		/**
		 * Validates the year, month, and day combination is valid.
		 *
		 * @public
		 * @param {Number} year
		 * @param {Number} month
		 * @param {Number} day
		 * @returns {Boolean}
		 */
		static validate(year, month, day) {
			return is.integer(year) &&
				is.integer(month) &&
				is.integer(day) &&
				!(month  < 1) &&
				!(month > 12) &&
				!(day  < 1) &&
				!(day > Day.getDaysInMonth(year, month));
		}

		/**
		 * Returns the number of days in a given month.
		 *
		 * @public
		 * @param {number} year - The year number (e.g. 2017)
		 * @param {number} month - The month number (e.g. 2 -- for February)
		 */
		static getDaysInMonth(year, month) {
			return 31; // need to fix this....
		}

		/**
		 * A comparator function for {@link Day} instances.
		 *
		 * @public
		 * @param {Day} a
		 * @param {Day} b
		 * @returns {Number}
		 */
		static compareDays(a, b) {
			assert.argumentIsRequired(a, 'a', Day, 'Day');
			assert.argumentIsRequired(b, 'b', Day, 'Day');

			return comparator(a, b);
		}

		toString() {
			return '[Day]';
		}
	}

	const dayRegex = /^([0-9]{4}).([0-9]{2}).([0-9]{2})$/;

	function leftPad(value) {
		return value < 10 ? `0${value}` : `${value}`;
	}

	const comparator = ComparatorBuilder.startWith((a, b) => comparators.compareNumbers(a.year, b.year))
		.thenBy((a, b) => comparators.compareNumbers(a.month, b.month))
		.thenBy((a, b) => comparators.compareNumbers(a.day, b.day))
		.toComparator();

	return Day;
})();
