(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const assert = require('./../../lang/assert'),
      is = require('./../../lang/is');

const FailureReasonItem = require('./FailureReasonItem'),
      FailureType = require('./FailureType'),
      Schema = require('./../../serialization/json/Schema'),
      Tree = require('./../../collections/Tree');

module.exports = (() => {
  'use strict';
  /**
   * Describes all of the reasons for API failure. Since there can be multiple reasons, the reasons are
   * stored in a tree structure.
   *
   * @public
   * @param {Object=} data - Data regarding the API request itself, likely independent of the failure data (which is maintained in the tree structure).
   */

  class FailureReason {
    constructor(data) {
      this._data = data || null;
      this._head = new Tree();
      this._current = this._head;
    }
    /**
     * Adds a {@link FailureReasonItem} to the tree of reason(s) at the current node.
     *
     * @public
     * @param {FailureType} type - The failure type.
     * @param {Object=} data - The data associated with the failure type.
     * @param {Boolean=} group - The reason is expected to have children; therefore, the current tree node is shifted to the newly added {@link FailureReasonItem}.
     * @returns {FailureReason} - The current instance, allowing for method chaining.
     */


    addItem(type, data, group) {
      assert.argumentIsRequired(type, 'type', FailureType, 'FailureType');
      assert.argumentIsOptional(group, 'group', Boolean);

      const node = this._current.addChild(new FailureReasonItem(type, data));

      if (is.boolean(group) && group) {
        this._current = node;
      }

      return this;
    }
    /**
     * Resets the current node to the head of the tree.
     *
     * @public
     * @returns {FailureReason} - The current instance, allowing for method chaining.
     */


    reset() {
      this._current = this._head;
      return this;
    }
    /**
     * Returns a tree of strings, describing the reason(s) for API failure.
     *
     * @public
     * @returns {Array}
     */


    format() {
      const reasons = this._head.toJSObj(item => {
        return {
          code: item ? item.type.code : null,
          message: item ? item.format(this._data) : null
        };
      });

      return reasons.children;
    }
    /**
     * Indicates if the tree of {@link FailureReasonItem} instances contains
     * at least one item with a matching {@link FailureType}.
     *
     * @public
     * @param {FailureType} type
     * @returns {Boolean}
     */


    hasFailureType(type) {
      assert.argumentIsRequired(type, 'type', FailureType, 'FailureType');
      return this._head.search(item => item.type === type, false, false) !== null;
    }
    /**
     * Indicates if the tree of {@link FailureReasonItem} instances contains
     * at least one item that is considered to be severe.
     *
     * @public
     * @returns {Boolean}
     */


    getIsSevere() {
      return this._head.search(item => item.type.severe, false, false) !== null;
    }

    toJSON() {
      return this.format();
    }
    /**
     * Factory function for creating instances of {@link FailureReason}.
     *
     * @public
     * @static
     * @param data
     * @returns {FailureReason}
     */


    static forRequest(data) {
      return new FailureReason(data);
    }
    /**
     * Returns an HTTP status code that would be suitable for use with the
     * failure reason.
     *
     * @public
     * @static
     * @param {FailureReason} reason
     * @returns {Number}
     */


    static getHttpStatusCode(reason) {
      assert.argumentIsRequired(reason, 'reason', FailureReason, 'FailureReason');
      let returnVal = null;

      reason._head.walk(item => {
        let code = FailureType.getHttpStatusCode(item.type);

        if (returnVal === null || returnVal !== 400) {
          returnVal = code;
        }
      }, false, false);

      return returnVal;
    }
    /**
     * Validates that a candidate conforms to a schema, returning a rejected
     * promise (with a serialized FailureReason) if a problem exists.
     *
     * @public
     * @static
     * @param {Schema|Enum} schema
     * @param {Object} candidate
     * @param {String=} description
     * @returns {Promise}
     */


    static validateSchema(schema, candidate, description) {
      return Promise.resolve().then(() => {
        let schemaToUse;

        if (schema instanceof Schema) {
          schemaToUse = schema;
        } else if (schema.schema && schema.schema instanceof Schema) {
          schemaToUse = schema.schema;
        } else {
          schemaToUse = null;
        }

        const fields = schemaToUse.getInvalidFields(candidate);
        let failure;

        if (fields.length !== 0) {
          failure = FailureReason.forRequest({
            endpoint: {
              description: description || `serialize data into ${schema.name}`
            }
          }).addItem(FailureType.REQUEST_INPUT_MALFORMED, {}, true);
          failure = fields.reduce((accumulator, field) => {
            accumulator.addItem(FailureType.REQUEST_PARAMETER_MALFORMED, {
              name: field.name
            });
            return accumulator;
          }, failure);
        } else {
          failure = null;
        }

        if (failure !== null) {
          return Promise.reject(failure.format());
        } else {
          return Promise.resolve(null);
        }
      });
    }

    toString() {
      return '[FailureReason]';
    }

  }

  return FailureReason;
})();

},{"./../../collections/Tree":7,"./../../lang/assert":30,"./../../lang/is":36,"./../../serialization/json/Schema":58,"./FailureReasonItem":2,"./FailureType":3}],2:[function(require,module,exports){
const assert = require('./../../lang/assert'),
      attributes = require('./../../lang/attributes');

const FailureType = require('./FailureType');

module.exports = (() => {
  'use strict';
  /**
   * One of the reason(s) for API failure, including any specific data that
   * allows a human-readable message to be generated.
   *
   * @public
   * @param {FailureType} type
   * @param {Object=} data
   */

  class FailureReasonItem {
    constructor(type, data) {
      assert.argumentIsRequired(type, 'type', FailureType, 'FailureType');
      this._type = type;
      this._data = data || null;
    }
    /**
     * The {@link FailureType} of the item.
     *
     * @public
     * @returns {FailureType}
     */


    get type() {
      return this._type;
    }
    /**
     * Formats a human-readable message, describing the failure.
     *
     * @public
     * @param {Object=} root - Root data from the {@link FailureReason}.
     * @returns {String}
     */


    format(root) {
      return this._type.template.replace(tokenRegex, (full, ignored, casing, token) => {
        let tokenToUse;
        let dataToRead;

        if (token.startsWith(rootPrefix)) {
          tokenToUse = token.slice(rootLength);
          dataToRead = root;
        } else {
          tokenToUse = token;
          dataToRead = this._data;
        }

        let replacement = attributes.read(dataToRead, tokenToUse);

        if (replacement) {
          if (casing === 'l') {
            replacement = `${replacement.slice(0, 1).toLowerCase()}${replacement.slice(1)}`;
          } else if (casing === 'u') {
            replacement = `${replacement.slice(0, 1).toUpperCase()}${replacement.slice(1)}`;
          } else if (casing === 'U') {
            replacement = `${replacement.toUpperCase()}`;
          } else if (casing === 'L') {
            replacement = `${replacement.toLowerCase()}`;
          }
        }

        return replacement;
      });
    }

    toString() {
      return '[FailureReasonItem]';
    }

  }

  const tokenRegex = /{(([U|L|l|u])\|)?([a-zA-Z.]*)}/g;
  const rootPrefix = 'root.';
  const rootLength = rootPrefix.length;
  return FailureReasonItem;
})();

},{"./../../lang/assert":30,"./../../lang/attributes":31,"./FailureType":3}],3:[function(require,module,exports){
const assert = require('./../../lang/assert'),
      Enum = require('./../../lang/Enum'),
      is = require('./../../lang/is');

module.exports = (() => {
  'use strict';
  /**
   * An enumeration that describes potential reasons for API failure.
   *
   * @public
   * @extends {Enum}
   * @param {String} code - The enumeration code (and description).
   * @param {String} template - The template string for formatting human-readable messages.
   * @param {Boolean=} severe - Indicates if the failure is severe (default is true).
   */

  class FailureType extends Enum {
    constructor(code, template, severe) {
      super(code, code);
      assert.argumentIsRequired(template, 'template', String);
      assert.argumentIsOptional(severe, 'severe', Boolean);
      this._template = template;

      if (is.boolean(severe)) {
        this._severe = severe;
      } else {
        this._severe = true;
      }
    }
    /**
     * The template string for formatting human-readable messages.
     *
     * @public
     * @returns {String}
     */


    get template() {
      return this._template;
    }
    /**
     * Indicates if the failure is serious.
     *
     * @public
     * @return {Boolean}
     */


    get severe() {
      return this._severe;
    }
    /**
     * One or more data points is missing.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get REQUEST_CONSTRUCTION_FAILURE() {
      return requestConstructionFailure;
    }
    /**
     * A data point is missing.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get REQUEST_PARAMETER_MISSING() {
      return requestParameterMissing;
    }
    /**
     * A data point is malformed.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get REQUEST_PARAMETER_MALFORMED() {
      return requestParameterMalformed;
    }
    /**
     * User identity could not be determined.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get REQUEST_IDENTITY_FAILURE() {
      return requestIdentifyFailure;
    }
    /**
     * User authorization failed.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get REQUEST_AUTHORIZATION_FAILURE() {
      return requestAuthorizationFailure;
    }
    /**
     * The request data cannot be parsed or interpreted.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get REQUEST_INPUT_MALFORMED() {
      return requestInputMalformed;
    }
    /**
     * The request failed for unspecified reasons.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get SCHEMA_VALIDATION_FAILURE() {
      return schemaValidationFailure;
    }
    /**
     * The request failed for unspecified reasons.
     *
     * @public
     * @static
     * @returns {FailureType}
     */


    static get REQUEST_GENERAL_FAILURE() {
      return requestGeneralFailure;
    }
    /**
     * Returns an HTTP status code that would be suitable for use with the
     * failure type.
     *
     * @public
     * @static
     * @param {FailureType} type
     * @returns {Number}
     */


    static getHttpStatusCode(type) {
      assert.argumentIsRequired(type, 'type', FailureType, 'FailureType');
      let returnVal;

      if (type === FailureType.REQUEST_IDENTITY_FAILURE) {
        returnVal = 401;
      } else if (type === FailureType.REQUEST_AUTHORIZATION_FAILURE) {
        returnVal = 403;
      } else {
        returnVal = 400;
      }

      return returnVal;
    }

    toString() {
      return `[FailureType (code=${this.code})]`;
    }

  }

  const requestConstructionFailure = new FailureType('REQUEST_CONSTRUCTION_FAILURE', 'An attempt to {L|root.endpoint.description} failed because some required information is missing.');
  const requestParameterMissing = new FailureType('REQUEST_PARAMETER_MISSING', 'The "{L|name}" field is required.');
  const requestParameterMalformed = new FailureType('REQUEST_PARAMETER_MALFORMED', 'The "{L|name}" field cannot be interpreted.');
  const requestIdentifyFailure = new FailureType('REQUEST_IDENTITY_FAILURE', 'An attempt to {L|root.endpoint.description} failed because your identity could not be determined.');
  const requestAuthorizationFailure = new FailureType('REQUEST_AUTHORIZATION_FAILURE', 'An attempt to {L|root.endpoint.description} failed. You are not authorized to perform this action.');
  const requestInputMalformed = new FailureType('REQUEST_INPUT_MALFORMED', 'An attempt to {L|root.endpoint.description} failed, the data structure is invalid.');
  const schemaValidationFailure = new FailureType('SCHEMA_VALIDATION_FAILURE', 'An attempt to read {U|schema} data failed (found "{L|key}" when expecting "{L|name}")');
  const requestGeneralFailure = new FailureType('REQUEST_GENERAL_FAILURE', 'An attempt to {L|root.endpoint.description} failed for unspecified reason(s).');
  return FailureType;
})();

},{"./../../lang/Enum":24,"./../../lang/assert":30,"./../../lang/is":36}],4:[function(require,module,exports){
module.exports = (() => {
  'use strict';
  /**
   * A singly linked list. Each instance represents a node in the list,
   * holding both an item, a reference to the next node.
   *
   * @public
   * @param {*} value - The value of current node.
   */

  class LinkedList {
    constructor(value) {
      this._value = value;
      this._next = null;
    }
    /**
     * Returns the value associated with the current node.
     *
     * @public
     * @returns {*}
     */


    getValue() {
      return this._value;
    }
    /**
     * Returns the next node, if it exists; otherwise a null value is returned.
     *
     * @public
     * @returns {Tree|null}
     */


    getNext() {
      return this._next;
    }
    /**
     * Returns true, if the node is the last one in the list.
     *
     * @public
     * @returns {boolean}
     */


    getIsTail() {
      return this._next === null;
    }
    /**
     * Adds (or inserts) a value after the current node and returns
     * the newly added node.
     *
     * @public
     * @param {*} value
     * @returns {LinkedList}
     */


    insert(value) {
      const next = new LinkedList(value);

      if (this._next) {
        next._next = this._next;
      }

      this._next = next;
      return next;
    }

    toString() {
      return '[LinkedList]';
    }

  }

  return LinkedList;
})();

},{}],5:[function(require,module,exports){
const assert = require('./../lang/assert');

module.exports = (() => {
  'use strict';
  /**
   * A queue collection (i.e. supports FIFO operations).
   *
   * @public
   */

  class Queue {
    constructor() {
      this._array = [];
    }
    /**
     * Adds an item to the queue.
     *
     * @public
     * @param {object} item
     * @returns {object} - The item added to the queue.
     */


    enqueue(item) {
      this._array.push(item);

      return item;
    }
    /**
     * Removes the next item from the queue and returns it. Throws if the queue is empty.
     *
     * @public
     * @returns {object} - The item added to the queue.
     */


    dequeue() {
      if (this.empty()) {
        throw new Error('Queue is empty');
      }

      return this._array.shift();
    }
    /**
     * Returns the next item in the queue (without removing it). Throws if the queue is empty.
     *
     * @public
     * @returns {object} - The item added to the queue.
     */


    peek() {
      if (this.empty()) {
        throw new Error('Queue is empty');
      }

      return this._array[0];
    }
    /**
     * Returns true if the queue is empty; otherwise false.
     *
     * @public
     * @returns {boolean}
     */


    empty() {
      return this._array.length === 0;
    }
    /**
     * Runs an action on each item in the queue.
     *
     * @public
     * @param {Function} action - The action to run.
     */


    scan(action) {
      assert.argumentIsRequired(action, 'action', Function);

      this._array.forEach(x => action(x));
    }
    /**
     * Outputs an array of the queue's items; without affecting the
     * queue's internal state;
     *
     * @public
     * @returns {Array}
     */


    toArray() {
      return this._array.slice(0);
    }

    toString() {
      return '[Queue]';
    }

  }

  return Queue;
})();

},{"./../lang/assert":30}],6:[function(require,module,exports){
const assert = require('./../lang/assert');

module.exports = (() => {
  'use strict';
  /**
   * A stack collection (supports LIFO operations).
   *
   * @public
   */

  class Stack {
    constructor() {
      this._array = [];
    }
    /**
     * Adds an item to the stack.
     *
     * @public
     * @param {object} item
     * @returns {object} - The item added to the stack.
     */


    push(item) {
      this._array.unshift(item);

      return item;
    }
    /**
     * Removes and returns an item from the stack. Throws if the stack is empty.
     *
     * @public
     * @returns {object} - The removed from the stack.
     */


    pop() {
      if (this.empty()) {
        throw new Error('Stack is empty');
      }

      return this._array.shift();
    }
    /**
     * Returns the next item in the stack (without removing it). Throws if the stack is empty.
     *
     * @public
     * @returns {object} - The item added to the queue.
     */


    peek() {
      if (this.empty()) {
        throw new Error('Stack is empty');
      }

      return this._array[0];
    }
    /**
     * Returns true if the queue is empty; otherwise false.
     *
     * @public
     * @returns {boolean}
     */


    empty() {
      return this._array.length === 0;
    }
    /**
     * Runs an action on each item in the stack.
     *
     * @public
     * @param {Function} action - The action to run.
     */


    scan(action) {
      assert.argumentIsRequired(action, 'action', Function);

      this._array.forEach(x => action(x));
    }
    /**
     * Outputs an array of the stacks's items; without affecting the
     * queue's internal state;
     *
     * @public
     * @returns {Array}
     */


    toArray() {
      return this._array.slice(0);
    }

    toString() {
      return '[Stack]';
    }

  }

  return Stack;
})();

},{"./../lang/assert":30}],7:[function(require,module,exports){
const is = require('./../lang/is');

module.exports = (() => {
  'use strict';
  /**
   * A tree data structure. Each instance represents a node, holding
   * an item, a reference to the parent node, and a reference to
   * children nodes. Children are stored in insertion order.
   *
   * @public
   * @param {*} value - The value of the node.
   * @param {Tree=} parent - The parent node. If not supplied, this will be the root node.
   */

  class Tree {
    constructor(value, parent) {
      this._value = value;
      this._parent = parent || null;
      this._children = [];
    }
    /**
     * Gets the root node.
     *
     * @public
     * @returns {Tree}
     */


    getRoot() {
      if (this.getIsRoot()) {
        return this;
      } else {
        return this._parent.getRoot();
      }
    }
    /**
     * Returns the parent node. If this is the root node, a null value is returned.
     *
     * @public
     * @returns {Tree|null}
     */


    getParent() {
      return this._parent;
    }
    /**
     * Returns the collection of children nodes.
     *
     * @public
     * @returns {Array<Tree>}
     */


    getChildren() {
      return this._children;
    }
    /**
     * Returns the value associated with the current node.
     *
     * @public
     * @returns {*}
     */


    getValue() {
      return this._value;
    }
    /**
     * Returns true if this node has no children; otherwise false.
     *
     * @public
     * @returns {boolean}
     */


    getIsLeaf() {
      return this._children.length === 0;
    }
    /**
     * Returns true if this node has no parent; otherwise false.
     *
     * @public
     * @returns {boolean}
     */


    getIsRoot() {
      return this._parent === null;
    }
    /**
     * Adds a child node to the current node and returns a reference
     * to the child node.
     *
     * @public
     * @param {*} value - The value of the child.
     * @returns {Tree}
     */


    addChild(value) {
      const returnRef = new Tree(value, this);

      this._children.push(returnRef);

      return returnRef;
    }
    /**
     * Removes a child node.
     *
     * @public
     * @param {Tree} node - The child to remove.
     */


    removeChild(node) {
      for (let i = this._children.length - 1; !(i < 0); i--) {
        const child = this._children[i];

        if (child === node) {
          this._children.splice(i, 1);

          child._parent = null;
          child._children = [];
          break;
        }
      }
    }
    /**
     * Removes the current node from the parent tree. Use on a root node
     * has no effect.
     *
     * @public
     */


    sever() {
      if (this.getIsRoot()) {
        return;
      }

      this.getParent().removeChild(this);
    }
    /**
     * Searches the children nodes for the first child node that matches the
     * predicate.
     *
     * @public
     * @param {Tree~nodePredicate} predicate - A predicate that tests each child node. The predicate takes two arguments -- the node's value, and the node itself.
     * @returns {Tree|null}
     */


    findChild(predicate) {
      let returnRef = null;

      for (let i = 0; i < this._children.length; i++) {
        let child = this._children[i];

        if (predicate(child.getValue(), child)) {
          returnRef = child;
          break;
        }
      }

      return returnRef;
    }
    /**
     * Searches the tree recursively, starting with the current node.
     *
     * @public
     * @param {Tree~nodePredicate} predicate - A predicate that tests each child node. The predicate takes two arguments -- the node's value, and the node itself.
     * @param {boolean=} childrenFirst - True, if the tree should be searched depth first.
     * @param {boolean=} includeCurrentNode - True, if the current node should be checked against the predicate.
     * @returns {Tree|null}
     */


    search(predicate, childrenFirst, includeCurrentNode) {
      let returnRef = null;

      if (returnRef === null && childrenFirst && includeCurrentNode && predicate(this.getValue(), this)) {
        returnRef = this;
      }

      for (let i = 0; i < this._children.length; i++) {
        const child = this._children[i];
        returnRef = child.search(predicate, childrenFirst, true);

        if (returnRef !== null) {
          break;
        }
      }

      if (returnRef === null && !childrenFirst && includeCurrentNode && predicate(this.getValue(), this)) {
        returnRef = this;
      }

      return returnRef;
    }
    /**
     * Walks the children of the current node, running an action on each node.
     *
     * @public
     * @param {Tree~nodeAction} walkAction - A action to apply to each node. The action takes two arguments -- the node's value, and the node itself.
     * @param {boolean=} childrenFirst - True if the tree should be walked depth first.
     * @param {boolean=} includeCurrentNode - True if the current node should be applied to the action.
     */


    walk(walkAction, childrenFirst, includeCurrentNode) {
      const predicate = (value, node) => {
        walkAction(value, node);
        return false;
      };

      this.search(predicate, childrenFirst, includeCurrentNode);
    }
    /**
     * Climbs the parents of the current node -- current node up to the root node, running an action on each node.
     *
     * @public
     * @param {Tree~nodeAction} climbAction - A action to apply to each node. The action takes two arguments -- the node's value, and the node itself.
     * @param {boolean=} includeCurrentNode - True if the current node should be applied to the action.
     */


    climb(climbAction, includeCurrentNode) {
      if (includeCurrentNode) {
        climbAction(this.getValue(), this);
      }

      if (this._parent !== null) {
        this._parent.climb(climbAction, true);
      }
    }
    /**
     * Climbs the tree, evaluating each parent until a predicate is matched. Once matched,
     * the {@link Tree} node is returned. Otherwise, if the predicate cannot be matched,
     * a null value is returned.
     *
     * @public
     * @param {Tree~nodePredicate} predicate - A predicate that tests each child node. The predicate takes two arguments -- the node's value, and the node itself.
     * @param {boolean=} includeCurrentNode - If true, the predicate will be applied to the current node.
     * @returns {Tree|null}
     */


    findParent(predicate, includeCurrentNode) {
      let returnRef;

      if (is.boolean(includeCurrentNode) && includeCurrentNode && predicate(this.getValue(), this)) {
        returnRef = this;
      } else if (this._parent !== null) {
        returnRef = this._parent.findParent(predicate, true);
      } else {
        returnRef = null;
      }

      return returnRef;
    }
    /**
     * Creates a representation of the tree using JavaScript objects and arrays.
     *
     * @public
     * @param {Function=} valueConverter - An optional function for converting the value of each node.
     * @param {Boolean=} valueConverter - If true, empty children arrays will be excluded from output.
     * @returns {Object}
     */


    toJSObj(valueConverter, omitEmptyChildren) {
      let valueConverterToUse;

      if (is.fn(valueConverter)) {
        valueConverterToUse = valueConverter;
      } else {
        valueConverterToUse = x => x;
      }

      const converted = {
        value: valueConverterToUse(this._value)
      };

      if (!(is.boolean(omitEmptyChildren) && omitEmptyChildren && this._children.length === 0)) {
        converted.children = this._children.map(child => child.toJSObj(valueConverter, omitEmptyChildren));
      }

      return converted;
    }

    toString() {
      return '[Tree]';
    }

  }
  /**
   * A predicate that is used to check a node (i.e. {@link Tree}).
   *
   * @callback Tree~nodePredicate
   * @param {*} item - The candidate node's item
   * @param {Tree} node - The candidate node.
   * @returns {Boolean}
   */

  /**
   * An action that is run on a node (i.e. {@link Tree}).
   *
   * @callback Tree~nodeAction
   * @param {*} item - The candidate node's item
   * @param {Tree} node - The candidate node.
   */


  return Tree;
})();

},{"./../lang/is":36}],8:[function(require,module,exports){
const assert = require('./../../lang/assert'),
      comparators = require('./comparators');

module.exports = (() => {
  'use strict';
  /**
   * A builder for compound comparator functions (e.g. sort by last name,
   * then by first name, then by social security number) that uses a fluent
   * interface.
   *
   * @public
   * @param {Function} comparator - The initial comparator.
   * @param {Boolean=} invert - Indicates if the comparator should sort in descending order.
   */

  class ComparatorBuilder {
    constructor(comparator, invert, previous) {
      assert.argumentIsRequired(comparator, 'comparator', Function);
      assert.argumentIsOptional(invert, 'invert', Boolean);
      this._comparator = comparator;
      this._invert = invert || false;
      this._previous = previous || null;
    }
    /**
     * Adds a new comparator to the list of comparators to use.
     *
     * @public
     * @param {Function} comparator - The next comparator function.
     * @param {Boolean=} invert - Indicates if the comparator should sort in descending order.
     * @returns {ComparatorBuilder}
     */


    thenBy(comparator, invert) {
      assert.argumentIsRequired(comparator, 'comparator', Function);
      assert.argumentIsOptional(invert, 'invert', Boolean);
      return new ComparatorBuilder(comparator, invert, this);
    }
    /**
     * Flips the order of the comparator (e.g. ascending to descending).
     *
     * @public
     * @returns {ComparatorBuilder}
     */


    invert() {
      let previous;

      if (this._previous) {
        previous = this._previous.invert();
      } else {
        previous = null;
      }

      return new ComparatorBuilder(this._comparator, !this._invert, previous);
    }
    /**
     * Returns the comparator function.
     *
     * @public
     * @returns {Function}
     */


    toComparator() {
      let previousComparator;

      if (this._previous) {
        previousComparator = this._previous.toComparator();
      } else {
        previousComparator = comparators.empty;
      }

      return (a, b) => {
        let result = previousComparator(a, b);

        if (result === 0) {
          let sortA;
          let sortB;

          if (this._invert) {
            sortA = b;
            sortB = a;
          } else {
            sortA = a;
            sortB = b;
          }

          result = this._comparator(sortA, sortB);
        }

        return result;
      };
    }

    toString() {
      return '[ComparatorBuilder]';
    }
    /**
     * Creates a {@link ComparatorBuilder}, given an initial comparator function.
     *
     * @public
     * @param {Function} comparator - The initial comparator.
     * @param {Boolean=} invert - Indicates if the comparator should sort in descending order.
     * @returns {ComparatorBuilder}
     */


    static startWith(comparator, invert) {
      return new ComparatorBuilder(comparator, invert);
    }

  }

  return ComparatorBuilder;
})();

},{"./../../lang/assert":30,"./comparators":9}],9:[function(require,module,exports){
const assert = require('./../../lang/assert');

module.exports = (() => {
  'use strict';
  /**
   * Functions that can be used as comparators.
   *
   * @public
   * @module collections/sorting/comparators
   */

  return {
    /**
     * Compares two dates (in ascending order).
     *
     * @static
     * @param {Date} a
     * @param {Date} b
     * @returns {Number}
     */
    compareDates: (a, b) => {
      assert.argumentIsRequired(a, 'a', Date);
      assert.argumentIsRequired(b, 'b', Date);
      return a - b;
    },

    /**
     * Compares two numbers (in ascending order).
     *
     * @static
     * @param {Number} a
     * @param {Number} b
     * @returns {Number}
     */
    compareNumbers: (a, b) => {
      assert.argumentIsRequired(a, 'a', Number);
      assert.argumentIsRequired(b, 'b', Number);
      return a - b;
    },

    /**
     * Compares two strings (in ascending order), using {@link String#localeCompare}.
     *
     * @static
     * @param {String} a
     * @param {String} b
     * @returns {Number}
     */
    compareStrings: (a, b) => {
      assert.argumentIsRequired(a, 'a', String);
      assert.argumentIsRequired(b, 'b', String);
      return a.localeCompare(b);
    },

    /**
     * Compares two boolean values (in ascending order -- false first, true second).
     *
     * @static
     * @param {Boolean} a
     * @param {Boolean} b
     * @returns {Number}
     */
    compareBooleans: (a, b) => {
      assert.argumentIsRequired(a, 'a', Boolean);
      assert.argumentIsRequired(b, 'b', Boolean);

      if (a === b) {
        return 0;
      } else if (a) {
        return 1;
      } else {
        return -1;
      }
    },

    /**
     * Compares two objects, always returning zero.
     *
     * @static
     * @param {*} a
     * @param {*} b
     * @returns {Number}
     */
    empty: (a, b) => {
      return 0;
    }
  };
})();

},{"./../../lang/assert":30}],10:[function(require,module,exports){
const assert = require('./../../lang/assert'),
      is = require('./../../lang/is');

module.exports = (() => {
  'use strict';
  /**
   * A map that stores data using a compound key -- without the need
   * to implement objects needing to implement equals and hashcode.
   *
   * @public
   * @param {Number} depth - The number of keys.
   */

  class CompoundMap {
    constructor(depth) {
      assert.argumentIsRequired(depth, 'depth', Number);
      this._depth = depth;
      this._map = {};
    }
    /**
     * Returns true if the map has a value (or a grouping of values) at the
     * given key.
     *
     * @public
     * @param {...String} keys
     * @returns {Boolean}
     */


    has(...keys) {
      validateKeys(keys, this._depth, false);
      let target = this._map;
      return keys.every(k => {
        const returnVal = target.hasOwnProperty(k);

        if (returnVal) {
          target = target[k];
        }

        return returnVal;
      });
    }
    /**
     * Puts a value into the map, overwriting any preexisting value.
     *
     * @public
     * @param {*} value
     * @param {...String} keys
     */


    put(value, ...keys) {
      validateKeys(keys, this._depth, true);
      let target = this._map;
      let final = keys.length - 1;
      keys.forEach((k, i) => {
        if (i === final) {
          target[k] = value;
        } else {
          if (!target.hasOwnProperty(k)) {
            target[k] = {};
          }

          target = target[k];
        }
      });
    }
    /**
     * Gets a value from the map, returning null if the value does not exist.
     *
     * @public
     * @param {...String} keys
     * @returns {*}
     */


    get(...keys) {
      validateKeys(keys, this._depth, true);
      return keys.reduce((target, k) => {
        let next;

        if (is.object(target) && target.hasOwnProperty(k)) {
          next = target[k];
        } else {
          next = null;
        }

        return next;
      }, this._map);
    }
    /**
     * Deletes a value (or a group of values) from the tree.
     *
     * @public
     * @param {...String} keys
     * @returns {Boolean}
     */


    remove(...keys) {
      validateKeys(keys, this._depth, false);
      let returnVal = this.has(...keys);

      if (returnVal) {
        keys.reduce((target, k, i) => {
          let next;

          if (keys.length === i + 1) {
            delete target[k];
          } else {
            next = target[k];
          }

          return next;
        }, this._map);
      }

      return returnVal;
    }

    toString() {
      return '[CompoundMap]';
    }

  }

  function validateKeys(keys, depth, exact) {
    assert.argumentIsValid(keys, 'keys', k => exact && k.length === depth || !exact && !(k.length > depth), 'incorrect number of keys');
  }

  return CompoundMap;
})();

},{"./../../lang/assert":30,"./../../lang/is":36}],11:[function(require,module,exports){
const Stack = require('./../Stack');

const assert = require('./../../lang/assert'),
      Disposable = require('./../../lang/Disposable'),
      is = require('./../../lang/is');

module.exports = (() => {
  'use strict';
  /**
   * A stack of {@link Disposable} instances which itself inherits {@Disposable}.
   * When {@link DisposableStack#dispose} is called, then each item in the collection
   * is disposed in order.
   *
   * @public
   * @extends {Disposable}
   */

  class DisposableStack extends Disposable {
    constructor() {
      super();
      this._stack = new Stack();
    }
    /**
     * Adds a new {@link Disposable} instance to the stack.
     *
     * @public
     * @param {Disposable} disposable - The item to add.
     */


    push(disposable) {
      assert.argumentIsRequired(disposable, 'disposable', Disposable, 'Disposable');

      if (this.getIsDisposed()) {
        throw new Error('Unable to push item onto DisposableStack because it has been disposed.');
      }

      this._stack.push(disposable);
    }

    _onDispose() {
      while (!this._stack.empty()) {
        this._stack.pop().dispose();
      }
    }

    static fromArray(bindings) {
      assert.argumentIsArray(bindings, 'bindings', Disposable, 'Disposable');
      const returnRef = new DisposableStack();

      for (let i = 0; i < bindings.length; i++) {
        returnRef.push(bindings[i]);
      }

      return returnRef;
    }

    static pushPromise(stack, promise) {
      assert.argumentIsRequired(stack, 'stack', DisposableStack, 'DisposableStack');
      assert.argumentIsRequired(promise, 'promise');
      return promise.then(b => {
        let bindings;

        if (is.array(b)) {
          bindings = b;
        } else {
          bindings = [b];
        }

        bindings.forEach(binding => stack.push(binding));
      });
    }

  }

  return DisposableStack;
})();

},{"./../../lang/Disposable":23,"./../../lang/assert":30,"./../../lang/is":36,"./../Stack":6}],12:[function(require,module,exports){
const assert = require('./../../lang/assert');

module.exports = (() => {
  'use strict';

  const empty = {};
  /**
   * A list that is restricted to a certain capacity. If adding an
   * item would exceed the capacity; the oldest item is removed.
   *
   * @public
   * @param {Number=} capacity - The maximum number of items the list can contain (defaults to ten).
   */

  class EvictingList {
    constructor(capacity) {
      assert.argumentIsOptional(capacity, 'capacity', Number);
      this._capacity = Math.max(capacity || 0, 0) || 10;
      this._array = [];

      for (let i = 0; i < this._capacity; i++) {
        this._array[i] = empty;
      }

      this._head = null;
    }
    /**
     * Adds an item to the list (possibly causing eviction, if the size of the
     * list exceeds the capacity).
     *
     * @public
     * @param {*} item
     */


    add(item) {
      this._array[this._head = getNextIndex(this._head, this._capacity)] = item;
    }
    /**
     * Returns the first item in the list, throwing an error if the list is empty.
     *
     * @public
     * @returns {*}
     */


    peek() {
      if (this.empty()) {
        throw new Error('EvictingList is empty');
      }

      return this._array[this._head];
    }
    /**
     * Returns true, if the list is empty; otherwise false.
     *
     * @public
     * @returns {Boolean}
     */


    empty() {
      return this._head === null;
    }
    /**
     * The capacity of the list.
     *
     * @public
     * @returns {Number}
     */


    getCapacity() {
      return this._capacity;
    }
    /**
     * Copies the items in the list to a new array.
     *
     * @returns {Array}
     */


    toArray() {
      let returnRef = [];

      if (!this.empty()) {
        let current = this._head;

        for (let i = 0; i < this._capacity; i++) {
          const item = this._array[current];

          if (item === empty) {
            break;
          }

          returnRef.push(item);
          current = getPreviousIndex(current, this._capacity);
        }
      }

      return returnRef;
    }

    toString() {
      return '[EvictingList]';
    }

  }

  const getNextIndex = (current, capacity) => {
    let returnVal;

    if (current === null) {
      returnVal = 0;
    } else {
      returnVal = current + 1;

      if (returnVal === capacity) {
        returnVal = 0;
      }
    }

    return returnVal;
  };

  const getPreviousIndex = (current, capacity) => {
    let returnVal;

    if (current === null) {
      returnVal = 0;
    } else {
      returnVal = current - 1;

      if (returnVal < 0) {
        returnVal = capacity - 1;
      }
    }

    return returnVal;
  };

  return EvictingList;
})();

},{"./../../lang/assert":30}],13:[function(require,module,exports){
const assert = require('./../../lang/assert');

module.exports = (() => {
  'use strict';
  /**
   * A map that is restricted to a certain capacity. If adding an
   * item would exceed the capacity; the oldest item is removed.
   *
   * @public
   * @param {Number=} capacity - The maximum number of items the map can contain (defaults to ten).
   */

  class EvictingMap {
    constructor(capacity) {
      assert.argumentIsOptional(capacity, 'capacity', Number);
      this._capacity = Math.max(capacity || 0, 0) || 10;
      this._map = {};
      this._head = null;
      this._tail = null;
      this._size = 0;
    }
    /**
     * Returns true, if the map contains the item; otherwise false.
     *
     * @public
     * @param {String} key
     * @returns {boolean}
     */


    has(key) {
      return this._map.hasOwnProperty(key);
    }
    /**
     * Puts an item into the map (possibly causing eviction, if the size of the
     * list exceeds the capacity).
     *
     * @public
     * @param {String} key
     * @param {*} value
     */


    put(key, value) {
      this.remove(key);
      let node;

      if (this._head !== null) {
        node = this._head.insertBefore(key);
        this._head = node;
      } else {
        node = new Node(key);
        this._head = node;
        this._tail = node;
      }

      this._map[key] = new Item(node, key, value);
      this._size++;

      while (this._size > this._capacity) {
        this.remove(this._tail.getItem());
      }
    }
    /**
     * Puts an item into the map (possibly causing eviction, if the size of the
     * list exceeds the capacity).
     *
     * @public
     * @param {String} key
     * @param {*} value
     */


    set(key, value) {
      this.put(key, value);
    }
    /**
     * Gets an item from the map, returning a null value if the no item
     * for the given key exists.
     *
     * @public
     * @param {String} key
     * @returns {*}
     */


    get(key) {
      let returnRef;
      const item = this._map[key];

      if (item) {
        returnRef = item.getValue();
        const node = item.getNode();

        if (node !== this._head) {
          if (node === this._tail) {
            this._tail = node._previous;
          }

          node.remove();
          this._head = this._head.insertBefore(key);
          item.setNode(this._head);
        }
      } else {
        returnRef = null;
      }

      return returnRef;
    }
    /**
     * Removes an item from the map.
     *
     * @public
     * @param {String} key
     */


    remove(key) {
      const item = this._map[key];

      if (item) {
        const node = item.getNode();
        const next = node.getNext();
        const previous = node.getPrevious();
        node.remove();

        if (this._head === node) {
          this._head = next;
        }

        if (this._tail === node) {
          this._tail = previous;
        }

        delete this._map[key];
        this._size--;
      }
    }
    /**
     * Removes an item from the map.
     *
     * @public
     * @param {String} key
     */


    delete(key) {
      this.remove(key);
    }
    /**
     * Returns true, if the map contains no items; otherwise false.
     *
     * @public
     * @param {String} key
     * @returns {boolean}
     */


    empty() {
      return this._size === 0;
    }
    /**
     * Returns the number of items stored in the map.
     *
     * @public
     * @returns {Number}
     */


    getSize() {
      return this._size;
    }
    /**
     * The capacity of the map.
     *
     * @public
     * @returns {Number}
     */


    getCapacity() {
      return this._capacity;
    }

    toString() {
      return '[EvictingMap]';
    }

  }

  class Item {
    constructor(node, key, value) {
      this._node = node;
      this._key = key;
      this._value = value;
    }

    getKey() {
      return this._key;
    }

    getValue() {
      return this._value;
    }

    getNode() {
      return this._node;
    }

    setNode(node) {
      this._node = node;
    }

  }

  class Node {
    constructor(item) {
      this._item = item;
      this._previous = null;
      this._next = null;
    }

    insertBefore(item) {
      const node = new Node(item);
      node._next = this;

      if (this._previous !== null) {
        node._previous = this._previous;
        this._previous._next = node;
      }

      this._previous = node;
      return node;
    }

    insertAfter(item) {
      const node = new Node(item);
      node._previous = this;

      if (this._next !== null) {
        node._next = this._next;
        this._next._previous = node;
      }

      this._next = node;
      return node;
    }

    remove() {
      const next = this._next;
      const previous = this._previous;
      this._next = null;
      this._previous = null;

      if (next && previous) {
        previous._next = next;
        next._previous = previous;
      } else if (next) {
        next._previous = null;
      } else if (previous) {
        previous._next = null;
      }

      return this;
    }

    getItem() {
      return this._item;
    }

    hasNext() {
      return this._next !== null;
    }

    getNext() {
      return this._next;
    }

    hasPrevious() {
      return this._previous !== null;
    }

    getPrevious() {
      return this._previous;
    }

  }

  return EvictingMap;
})();

},{"./../../lang/assert":30}],14:[function(require,module,exports){
const array = require('./../../lang/array'),
      assert = require('./../../lang/assert'),
      Queue = require('./../Queue');

module.exports = (() => {
  'use strict';
  /**
   * A queue that sorts items as they are inserted.
   *
   * @public
   * @extends {Queue}
   */

  class PriorityQueue extends Queue {
    constructor(comparator) {
      super();
      assert.argumentIsRequired(comparator, 'comparator', Function);
      this._comparator = comparator;
    }

    enqueue(item) {
      array.insert(this._array, item, this._comparator);
      return item;
    }

    dequeue() {
      return super.dequeue();
    }

    peek() {
      return super.peek();
    }

    scan(action) {
      return super.scan(action);
    }

    toArray() {
      return super.toArray();
    }

    toString() {
      return '[PriorityQueue]';
    }

  }

  return PriorityQueue;
})();

},{"./../../lang/array":29,"./../../lang/assert":30,"./../Queue":5}],15:[function(require,module,exports){
const assert = require('./../../lang/assert'),
      is = require('./../../lang/is');

module.exports = (() => {
  'use strict';
  /**
   * A map that which only holds objects for a specified duration.
   *
   * @public
   * @param {Number=} duration - The time to live, in milliseconds.
   */

  class TimeMap {
    constructor(duration) {
      assert.argumentIsValid(duration, 'duration', x => is.positive(x), 'is positive');
      this._duration = duration;
      this._map = {};
    }
    /**
     * Returns true, if the map contains the item; otherwise false.
     *
     * @public
     * @param {String} key
     * @returns {boolean}
     */


    has(key) {
      assert.argumentIsRequired(key, 'key', String);

      let exists = this._map.hasOwnProperty(key);

      if (exists) {
        const item = this._map[key];

        if (!item.valid) {
          this.remove(key);
          exists = false;
        }
      }

      return exists;
    }
    /**
     * Puts an item into the map.
     *
     * @public
     * @param {String} key
     * @param {*} value
     */


    put(key, value) {
      assert.argumentIsRequired(key, 'key', String);
      this._map[key] = new Item(key, value, new Date().getTime() + this._duration);
    }
    /**
     * Puts an item into the map (possibly causing eviction, if the size of the
     * list exceeds the capacity).
     *
     * @public
     * @param {String} key
     * @param {*} value
     */


    set(key, value) {
      this.put(key, value);
    }
    /**
     * Gets an item from the map, returning a null value if the no item
     * for the given key exists.
     *
     * @public
     * @param {String} key
     * @returns {*}
     */


    get(key) {
      assert.argumentIsRequired(key, 'key', String);
      let returnRef = null;

      if (this.has(key)) {
        returnRef = this._map[key].value;
      }

      return returnRef;
    }
    /**
     * Removes an item from the map.
     *
     * @public
     * @param {String} key
     */


    remove(key) {
      assert.argumentIsRequired(key, 'key', String);
      delete this._map[key];
    }
    /**
     * Removes an item from the map.
     *
     * @public
     * @param {String} key
     */


    delete(key) {
      this.remove(key);
    }

    toString() {
      return '[TimeMap]';
    }

  }

  class Item {
    constructor(key, value, expiration) {
      this._key = key;
      this._value = value;
      this._expiration = expiration;
    }

    get key() {
      return this._key;
    }

    get value() {
      return this._value;
    }

    get valid() {
      return this._expiration > new Date().getTime();
    }

  }

  return TimeMap;
})();

},{"./../../lang/assert":30,"./../../lang/is":36}],16:[function(require,module,exports){
const assert = require('./../lang/assert');

module.exports = (() => {
  'use strict';
  /**
   * An object that can perform an action.
   *
   * @public
   * @interface
   */

  class CommandHandler {
    constructor() {}
    /**
     * Execute the action.
     *
     * @public
     * @param {*} data
     * @returns {*}
     */


    process(data) {
      return this._process(data);
    }
    /**
     * @protected
     * @param {*} data
     * @returns {*}
     */


    _process(data) {
      return true;
    }

    toString() {
      return '[CommandHandler]';
    }
    /**
     * Returns a function which executes the command.
     *
     * @public
     * @param {CommandHandler} commandHandler
     * @returns {function(*=)}
     */


    static toFunction(commandHandler) {
      assert.argumentIsRequired(commandHandler, 'commandHandler', CommandHandler, 'CommandHandler');
      return data => {
        return commandHandler.process(data);
      };
    }
    /**
     * Returns a {@link CommandHandler} that delegates execution to a function.
     *
     * @public
     * @param {Function} handler - The function which the command delegates to.
     * @returns {CommandHandler}
     */


    static fromFunction(handler) {
      assert.argumentIsRequired(handler, 'handler', Function);
      return new DelegateCommandHandler(handler);
    }

  }

  class DelegateCommandHandler extends CommandHandler {
    constructor(handler) {
      super();
      this._handler = handler;
    }

    _process(data) {
      return this._handler(data);
    }

  }

  return CommandHandler;
})();

},{"./../lang/assert":30}],17:[function(require,module,exports){
const assert = require('./../lang/assert'),
      CommandHandler = require('./CommandHandler');

module.exports = (() => {
  'use strict';

  class CompositeCommandHandler extends CommandHandler {
    constructor(commandHandlerA, commandHandlerB) {
      super();
      assert.argumentIsRequired(commandHandlerA, 'commandHandlerA', CommandHandler, 'CommandHandler');
      assert.argumentIsRequired(commandHandlerB, 'commandHandlerB', CommandHandler, 'CommandHandler');
      assert.areNotEqual(commandHandlerA, commandHandlerB, 'commandHandlerA', 'commandHandlerB');
      this._commandHandlerA = commandHandlerA;
      this._commandHandlerB = commandHandlerB;
    }

    _process(data) {
      return this._commandHandlerA.process(data) && this._commandHandlerB.process(data);
    }

    toString() {
      return '[CompositeCommandHandler]';
    }

  }

  return CompositeCommandHandler;
})();

},{"./../lang/assert":30,"./CommandHandler":16}],18:[function(require,module,exports){
var assert = require('./../lang/assert'),
    CommandHandler = require('./CommandHandler');

module.exports = (() => {
  'use strict';

  class MappedCommandHandler extends CommandHandler {
    constructor(nameExtractor) {
      super();
      assert.argumentIsRequired(nameExtractor, 'nameFunction', Function);
      this._handlerMap = {};
      this._defaultHandler = null;
      this._nameExtractor = nameExtractor;
    }

    addCommandHandler(name, commandHandler) {
      assert.argumentIsRequired(name, 'name', String);
      assert.argumentIsRequired(commandHandler, 'commandHandler', CommandHandler, 'CommandHandler');

      if (this._handlerMap.hasOwnProperty(name)) {
        throw new Error('A handler with the same name already exists in the map');
      }

      if (commandHandler === this) {
        throw new Error('Recursive use of mapped command handlers is prohibited');
      }

      this._handlerMap[name] = commandHandler;
      return this;
    }

    setDefaultCommandHandler(commandHandler) {
      assert.argumentIsRequired(commandHandler, 'commandHandler', CommandHandler, 'CommandHandler');
      this._defaultHandler = commandHandler;
      return this;
    }

    _process(data) {
      const handlerName = this._nameExtractor(data);

      const handler = this._handlerMap[handlerName] || this._defaultHandler;
      let returnRef;

      if (handler) {
        returnRef = handler.process(data);
      } else {
        returnRef = null;
      }

      return returnRef;
    }

    toString() {
      return '[MappedCommandHandler]';
    }

  }

  return MappedCommandHandler;
})();

},{"./../lang/assert":30,"./CommandHandler":16}],19:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

module.exports = (() => {
  'use strict';
  /**
   * A serialization container for ad hoc data where internal data is serialized
   * as an escaped JSON string.
   *
   * @public
   * @param {Object} data
   */

  class AdHoc {
    constructor(data) {
      this._data = data || {};
    }
    /**
     * The data.
     * 
     * @public
     * @returns {Object}
     */


    get data() {
      return this._data;
    }
    /**
     * The data.
     *
     * @public
     * @param {Object} data
     */


    set data(data) {
      assert.argumentIsRequired(data, 'data', Object);
      this._data = data;
    }

    toJSON() {
      return JSON.stringify(this._data);
    }
    /**
     * Given a code, returns the enumeration item.
     *
     * @public
     * @param {String} code
     * @returns {AdHoc}
     */


    static parse(serialized) {
      return new AdHoc(JSON.parse(serialized));
    }

    toString() {
      return '[AdHoc]';
    }

  }

  return AdHoc;
})();

},{"./assert":30,"./is":36}],20:[function(require,module,exports){
const assert = require('./assert'),
      Enum = require('./Enum'),
      is = require('./is');

module.exports = (() => {
  'use strict';
  /**
   * An enumeration for currency types.
   *
   * @public
   * @param {String} code - Currency code (e.g. "USD")
   * @param {String} description - The description (e.g. "US Dollar")
   * @param {Number} precision - The number of decimal places possible for by a real world transaction.
   * @extends {Enum}
   */

  class Currency extends Enum {
    constructor(code, description, precision, alternateDescription) {
      super(code, description);
      assert.argumentIsRequired(precision, 'precision', Number);
      assert.argumentIsValid(precision, 'precision', is.integer, 'is an integer');
      assert.argumentIsOptional(alternateDescription, 'alternateDescription', String);
      this._precision = precision;
      this._alternateDescription = alternateDescription || description;
    }
    /**
     * The maximum number of decimal places supported by a real world transaction.
     *
     * @public
     * @returns {Number}
     */


    get precision() {
      return this._precision;
    }
    /**
     * An alternate human-readable description.
     *
     * @public
     * @returns {String}
     */


    get alternateDescription() {
      return this._alternateDescription;
    }
    /**
     * Given a code, returns the enumeration item.
     *
     * @public
     * @param {String} code
     * @returns {Currency|null}
     */


    static parse(code) {
      return Enum.fromCode(Currency, code);
    }
    /**
     * The Canadian Dollar.
     *
     * @public
     * @returns {Currency}
     */


    static get CAD() {
      return cad;
    }
    /**
     * The Euro.
     *
     * @public
     * @returns {Currency}
     */


    static get EUR() {
      return eur;
    }
    /**
     * The US Dollar.
     *
     * @public
     * @returns {Currency}
     */


    static get USD() {
      return usd;
    }

    toString() {
      return `[Currency (code=${this.code})]`;
    }

  }

  const cad = new Currency('CAD', 'Canadian Dollar', 2, 'CAD$');
  const eur = new Currency('EUR', 'Euro', 2, 'EUR');
  const usd = new Currency('USD', 'US Dollar', 2, 'US$');
  return Currency;
})();

},{"./Enum":24,"./assert":30,"./is":36}],21:[function(require,module,exports){
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
   * @param {Number} year
   * @param {Number} month
   * @param {Number} day
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
      let totalDaysToShift;

      if (is.boolean(inverse) && inverse) {
        totalDaysToShift = days * -1;
      } else {
        totalDaysToShift = days;
      }

      const positive = is.positive(totalDaysToShift);
      let shiftedDay = this._day;
      let shiftedMonth = this._month;
      let shiftedYear = this._year;

      while (totalDaysToShift !== 0) {
        let monthDaysAvailable;
        let monthDaysToShift;

        if (positive) {
          monthDaysAvailable = Day.getDaysInMonth(shiftedYear, shiftedMonth) - shiftedDay;
          monthDaysToShift = Math.min(totalDaysToShift, monthDaysAvailable);
        } else {
          monthDaysAvailable = 1 - shiftedDay;
          monthDaysToShift = Math.max(totalDaysToShift, monthDaysAvailable);
        }

        totalDaysToShift = totalDaysToShift - monthDaysToShift;

        if (totalDaysToShift === 0) {
          shiftedDay = shiftedDay + monthDaysToShift;
        } else if (positive) {
          shiftedMonth++;

          if (shiftedMonth > 12) {
            shiftedYear++;
            shiftedMonth = 1;
          }

          shiftedDay = 0;
        } else {
          shiftedMonth--;

          if (shiftedMonth < 1) {
            shiftedYear--;
            shiftedMonth = 12;
          }

          shiftedDay = Day.getDaysInMonth(shiftedYear, shiftedMonth) + 1;
        }
      }

      return new Day(shiftedYear, shiftedMonth, shiftedDay);
    }
    /**
     * Calculates a new {@link Day} in the past (or future).
     *
     * @public
     * @param {Number} days - The number of days to subtract (negative numbers can be used for addition).
     * @returns {Day}
     */


    subtractDays(days) {
      return this.addDays(days, true);
    }
    /**
     * Calculates a new {@link Day} in the future (or past). If the new date is at the end of
     * the month and the new month has fewer days than the current month, days will be subtracted
     * as necessary (e.g. adding one month to March 31 will return April 30).
     *
     * @public
     * @param {Number} months - The number of months to add (negative numbers can be used for subtraction).
     * @param {Boolean=} inverse - If true, the sign of the "days" value will be flipped.
     * @returns {Day}
     */


    addMonths(months, inverse) {
      assert.argumentIsRequired(months, 'months', Number);
      assert.argumentIsOptional(inverse, inverse, Boolean);
      assert.argumentIsValid(months, 'months', is.large, 'is an integer');
      let totalMonthsToShift;

      if (is.boolean(inverse) && inverse) {
        totalMonthsToShift = months * -1;
      } else {
        totalMonthsToShift = months;
      }

      const monthsToShift = totalMonthsToShift % 12;
      const yearsToShift = (totalMonthsToShift - monthsToShift) / 12;
      let shiftedYear = this.year + yearsToShift;
      let shiftedMonth = this.month + monthsToShift;
      let shiftedDay = this.day;

      if (shiftedMonth > 12) {
        shiftedYear = shiftedYear + 1;
        shiftedMonth = shiftedMonth - 12;
      }

      if (shiftedMonth < 1) {
        shiftedYear = shiftedYear - 1;
        shiftedMonth = shiftedMonth + 12;
      }

      while (!Day.validate(shiftedYear, shiftedMonth, shiftedDay)) {
        shiftedDay = shiftedDay - 1;
      }

      return new Day(shiftedYear, shiftedMonth, shiftedDay);
    }
    /**
     * Calculates a new {@link Day} in the past (or future).
     *
     * @public
     * @param {Number} months - The number of months to subtract (negative numbers can be used for addition).
     * @returns {Day}
     */


    subtractMonths(months) {
      return this.addMonths(months, true);
    }
    /**
     * Calculates a new {@link Day} in the future (or past). If the new date is at the end of
     * the month and the new month has fewer days than the current month, days will be subtracted
     * as necessary (e.g. adding one year to February 29 will return February 28).
     *
     * @public
     * @param {Number} years - The number of years to add (negative numbers can be used for subtraction).
     * @param {Boolean=} inverse - If true, the sign of the "days" value will be flipped.
     * @returns {Day}
     */


    addYears(years, inverse) {
      assert.argumentIsRequired(years, 'years', Number);
      assert.argumentIsOptional(inverse, inverse, Boolean);
      assert.argumentIsValid(years, 'years', is.large, 'is an integer');
      let yearsToShift;

      if (is.boolean(inverse) && inverse) {
        yearsToShift = years * -1;
      } else {
        yearsToShift = years;
      }

      let shiftedYear = this.year + yearsToShift;
      let shiftedMonth = this.month;
      let shiftedDay = this.day;

      while (!Day.validate(shiftedYear, shiftedMonth, shiftedDay)) {
        shiftedDay = shiftedDay - 1;
      }

      return new Day(shiftedYear, shiftedMonth, shiftedDay);
    }
    /**
     * Calculates a new {@link Day} in the past (or future).
     *
     * @public
     * @param {Number} years - The number of years to subtract (negative numbers can be used for addition).
     * @returns {Day}
     */


    subtractYears(years) {
      return this.addYears(years, true);
    }
    /**
     * Returns a new {@link Day} instance for the start of the month referenced by the current instance.
     *
     * @public
     * @returns {Day}
     */


    getStartOfMonth() {
      return new Day(this.year, this.month, 1);
    }
    /**
     * Returns a new instance for the {@link Day} end of the month referenced by the current instance.
     *
     * @public
     * @returns {Day}
     */


    getEndOfMonth() {
      return new Day(this.year, this.month, Day.getDaysInMonth(this.year, this.month));
    }
    /**
     * Indicates if another {@link Day} occurs before the current instance.
     *
     * @public
     * @param {Day} other
     * @returns {boolean}
     */


    getIsBefore(other) {
      return Day.compareDays(this, other) < 0;
    }
    /**
     * Indicates if another {@link Day} occurs after the current instance.
     *
     * @public
     * @param {Day} other
     * @returns {boolean}
     */


    getIsAfter(other) {
      return Day.compareDays(this, other) > 0;
    }
    /**
     * Indicates the current day falls between two other days, inclusive
     * of the range boundaries.
     *
     * @public
     * @param {Day=} first
     * @param {Day=} last
     * @param {boolean=} exclusive
     * @returns {boolean}
     */


    getIsContained(first, last) {
      assert.argumentIsOptional(first, 'first', Day, 'Day');
      assert.argumentIsOptional(last, 'last', Day, 'Day');
      let notAfter;
      let notBefore;

      if (first && last && first.getIsAfter(last)) {
        notBefore = false;
        notAfter = false;
      } else {
        notAfter = !(last instanceof Day) || !this.getIsAfter(last);
        notBefore = !(first instanceof Day) || !this.getIsBefore(first);
      }

      return notAfter && notBefore;
    }
    /**
     * Indicates if another {@link Day} occurs after the current instance.
     *
     * @public
     * @param {Day} other
     * @returns {boolean}
     */


    getIsEqual(other) {
      return Day.compareDays(this, other) === 0;
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
     * @returns {Number}
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
      return `${leftPad(this._year, 4, '0')}-${leftPad(this._month, 2, '0')}-${leftPad(this._day, 2, '0')}`;
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
     * Clones a {@link Day} instance.
     *
     * @public
     * @static
     * @param {Day} value
     * @returns {Day}
     */


    static clone(value) {
      assert.argumentIsRequired(value, 'value', Day, 'Day');
      return new Day(value.year, value.month, value.day);
    }
    /**
     * Converts a string (which matches the output of {@link Day#format}) into
     * a {@link Day} instance.
     *
     * @public
     * @static
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
     * Creates a {@link Day} from the year, month, and day properties (in local time)
     * of the {@link Date} argument.
     *
     * @public
     * @static
     * @param {Date} date
     * @returns {Day}
     */


    static fromDate(date) {
      assert.argumentIsRequired(date, 'date', Date);
      return new Day(date.getFullYear(), date.getMonth() + 1, date.getDate());
    }
    /**
     * Creates a {@link Day} from the year, month, and day properties (in UTC)
     * of the {@link Date} argument.
     *
     * @public
     * @static
     * @param {Date} date
     * @returns {Day}
     */


    static fromDateUtc(date) {
      assert.argumentIsRequired(date, 'date', Date);
      return new Day(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
    /**
     * Returns a {@link Day} instance using today's local date.
     *
     * @static
     * @public
     * @returns {Day}
     */


    static getToday() {
      return Day.fromDate(new Date());
    }
    /**
     * Returns true if the year, month, and day combination is valid; otherwise false.
     *
     * @public
     * @static
     * @param {Number} year
     * @param {Number} month
     * @param {Number} day
     * @returns {Boolean}
     */


    static validate(year, month, day) {
      return is.integer(year) && is.integer(month) && is.integer(day) && !(month < 1) && !(month > 12) && !(day < 1) && !(day > Day.getDaysInMonth(year, month));
    }
    /**
     * Returns the number of days in a given month.
     *
     * @public
     * @static
     * @param {number} year - The year number (e.g. 2017)
     * @param {number} month - The month number (e.g. 2 is February)
     */


    static getDaysInMonth(year, month) {
      switch (month) {
        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
        case 12:
          {
            return 31;
          }

        case 4:
        case 6:
        case 9:
        case 11:
          {
            return 30;
          }

        case 2:
          {
            if (year % 4 === 0 && year % 100 !== 0 || year % 400 === 0) {
              return 29;
            } else {
              return 28;
            }
          }
      }
    }
    /**
     * A comparator function for {@link Day} instances.
     *
     * @public
     * @static
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

  const dayRegex = /^([0-9]{4}).?([0-9]{2}).?([0-9]{2})$/;

  function leftPad(value, digits, character) {
    let string = value.toString();
    let padding = digits - string.length;
    return `${character.repeat(padding)}${string}`;
  }

  const comparator = ComparatorBuilder.startWith((a, b) => comparators.compareNumbers(a.year, b.year)).thenBy((a, b) => comparators.compareNumbers(a.month, b.month)).thenBy((a, b) => comparators.compareNumbers(a.day, b.day)).toComparator();
  return Day;
})();

},{"./../collections/sorting/ComparatorBuilder":8,"./../collections/sorting/comparators":9,"./assert":30,"./is":36}],22:[function(require,module,exports){
const assert = require('./assert'),
      Enum = require('./Enum'),
      is = require('./is');

const Big = require('big.js');

module.exports = (() => {
  'use strict';
  /**
   * An immutable object that allows for arbitrary-precision calculations.
   *
   * @public
   * @param {Decimal|Number|String} value - The value.
   */

  class Decimal {
    constructor(value) {
      this._big = getBig(value);
    }
    /**
     * Returns a new {@link Decimal} instance that is the sum of the
     * current instance's value and the value supplied.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to add.
     * @returns {Decimal}
     */


    add(other) {
      return new Decimal(this._big.plus(getBig(other)));
    }
    /**
     * Returns a new {@link Decimal} instance with a value that results
     * from the subtraction of the value supplied from the current instance's
     * value.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to subtract.
     * @returns {Decimal}
     */


    subtract(other) {
      return new Decimal(this._big.minus(getBig(other)));
    }
    /**
     * Returns a new {@link Decimal} instance that is the product of the
     * current instance's value and the value supplied.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to add.
     * @returns {Decimal}
     */


    multiply(other) {
      return new Decimal(this._big.times(getBig(other)));
    }
    /**
     * Returns a new {@link Decimal} instance with a value that results
     * from the division of the current instance's value by the value
     * supplied.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to subtract.
     * @returns {Decimal}
     */


    divide(other) {
      return new Decimal(this._big.div(getBig(other)));
    }
    /**
     * Returns a new {@link Decimal} instance with a value that results
     * from raising the current instance to the power of the exponent
     * provided.
     *
     * @public
     * @param {Decimal|Number|String} exponent
     * @returns {Decimal}
     */


    raise(exponent) {
      assert.argumentIsRequired(exponent, 'exponent', Number);
      return new Decimal(this._big.pow(exponent));
    }
    /**
     * Returns a new {@link Decimal} with a value resulting from a rounding
     * operation on the current value.
     *
     * @public
     * @param {Number} places - The number of decimal places to retain.
     * @param {RoundingMode=} mode - The strategy to use for rounding.
     * @returns {Decimal}
     */


    round(places, mode) {
      assert.argumentIsRequired(places, 'places', Number);
      assert.argumentIsOptional(mode, 'mode', RoundingMode, 'RoundingMode');
      const modeToUse = mode || RoundingMode.NORMAL;
      return new Decimal(this._big.round(places, modeToUse.value));
    }
    /**
     * Returns a new {@link Decimal} instance having the absolute value of
     * the current instance's value.
     *
     * @public
     * @returns {Decimal}
     */


    absolute() {
      return new Decimal(this._big.abs());
    }
    /**
     * Returns a new {@link Decimal} instance the opposite sign as the
     * current instance's value.
     *
     * @public
     * @returns {Decimal}
     */


    opposite() {
      return this.multiply(-1);
    }
    /**
     * Returns a Boolean value, indicating if the current instance's value is
     * equal to zero (or approximately equal to zero).
     *
     * @public
     * @param {Boolean=} approximate
     * @param {Number=} places
     * @returns {Boolean}
     */


    getIsZero(approximate, places) {
      assert.argumentIsOptional(approximate, 'approximate', Boolean);
      assert.argumentIsOptional(places, 'places', Number);
      return this._big.eq(zero) || is.boolean(approximate) && approximate && this.round(places || Big.DP, RoundingMode.NORMAL).getIsZero();
    }
    /**
     * Returns true if the current instance is positive; otherwise false.
     *
     * @public
     * @returns {Boolean}
     */


    getIsPositive() {
      return this._big.gt(zero);
    }
    /**
     * Returns true if the current instance is negative; otherwise false.
     *
     * @public
     * @returns {Boolean}
     */


    getIsNegative() {
      return this._big.lt(zero);
    }
    /**
     * Returns true if the current instance is greater than the value.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to compare.
     * @returns {Boolean}
     */


    getIsGreaterThan(other) {
      return this._big.gt(getBig(other));
    }
    /**
     * Returns true if the current instance is greater than or equal to the value.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to compare.
     * @returns {Boolean}
     */


    getIsGreaterThanOrEqual(other) {
      return this._big.gte(getBig(other));
    }
    /**
     * Returns true if the current instance is less than the value.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to compare.
     * @returns {Boolean}
     */


    getIsLessThan(other) {
      return this._big.lt(getBig(other));
    }
    /**
     * Returns true if the current instance is less than or equal to the value.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to compare.
     * @returns {Boolean}
     */


    getIsLessThanOrEqual(other) {
      return this._big.lte(getBig(other));
    }
    /**
     * Returns true if the current instance is equal to the value.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to compare.
     * @returns {Boolean}
     */


    getIsEqual(other) {
      return this._big.eq(getBig(other));
    }
    /**
     * Returns true is close to another value.
     *
     * @public
     * @param {Decimal|Number|String} other - The value to compare.
     * @param {Number} places - The significant digits.
     * @returns {Boolean}
     */


    getIsApproximate(other, places) {
      if (places === 0) {
        return this.getIsEqual(other);
      }

      const difference = this.subtract(other).absolute();
      const tolerance = Decimal.ONE.divide(new Decimal(10).raise(places));
      return difference.getIsLessThan(tolerance);
    }
    /**
     * Returns true if the current instance is an integer (i.e. has no decimal
     * component).
     *
     * @public
     * @return {Boolean}
     */


    getIsInteger() {
      return this.getIsEqual(this.round(0));
    }
    /**
     * Returns the number of decimal places used.
     *
     * @public
     * @returns {Number}
     */


    getDecimalPlaces() {
      const matches = this.toFixed().match(/-?\d*\.(\d*)/);
      let returnVal;

      if (matches === null) {
        returnVal = 0;
      } else {
        returnVal = matches[1].length;
      }

      return returnVal;
    }
    /**
     * Emits a floating point value that approximates the value of the current
     * instance.
     *
     * @public
     * @param {Number=} places
     * @returns {Number}
     */


    toFloat(places) {
      assert.argumentIsOptional(places, 'places', Number); // Accepting places might be a mistake here; perhaps
      // the consumer should be forced to use the round
      // function.

      return parseFloat(this._big.toFixed(places || 16));
    }
    /**
     * Returns a string-based representation of the instance's value.
     *
     * @public
     * @returns {String}
     */


    toFixed() {
      return this._big.toFixed();
    }
    /**
     * Returns the JSON representation.
     *
     * @public
     * @returns {String}
     */


    toJSON() {
      return this.toFixed();
    }
    /**
     * Clones a {@link Decimal} instance.
     *
     * @public
     * @static
     * @param {Decimal} value
     * @returns {Decimal}
     */


    static clone(value) {
      assert.argumentIsRequired(value, 'value', Decimal, 'Decimal');
      return new Decimal(value._big);
    }
    /**
     * Parses the value emitted by {@link Decimal#toJSON}.
     *
     * @public
     * @param {String} value
     * @returns {Decimal}
     */


    static parse(value) {
      return new Decimal(value);
    }
    /**
     * Returns an instance with the value of zero.
     *
     * @public
     * @returns {Decimal}
     */


    static get ZERO() {
      return decimalZero;
    }
    /**
     * Returns an instance with the value of one.
     *
     * @public
     * @returns {Decimal}
     */


    static get ONE() {
      return decimalOne;
    }
    /**
     * Returns an instance with the value of one.
     *
     * @public
     * @returns {Decimal}
     */


    static get NEGATIVE_ONE() {
      return decimalNegativeOne;
    }
    /**
     * Return the {@link RoundingMode} enumeration.
     *
     * @public
     * @returns {RoundingMode}
     */


    static get ROUNDING_MODE() {
      return RoundingMode;
    }
    /**
     * Runs {@link Decimal#getIsZero} and returns the result.
     *
     * @public
     * @param {Decimal} instance
     * @returns {Boolean}
     */


    static getIsZero(instance) {
      assert.argumentIsRequired(instance, 'instance', Decimal, 'Decimal');
      return instance.getIsZero();
    }
    /**
     * Runs {@link Decimal#getIsZero} and returns the inverse.
     *
     * @public
     * @param {Decimal} instance
     * @returns {Boolean}
     */


    static getIsNotZero(instance) {
      assert.argumentIsRequired(instance, 'instance', Decimal, 'Decimal');
      return !instance.getIsZero();
    }
    /**
     * Runs {@link Decimal#getIsPositive} and returns the result.
     *
     * @public
     * @param {Decimal} instance
     * @returns {Boolean}
     */


    static getIsPositive(instance) {
      assert.argumentIsRequired(instance, 'instance', Decimal, 'Decimal');
      return instance.getIsPositive();
    }
    /**
     * Checks an instance to see if its negative or zero.
     *
     * @public
     * @param {Decimal} instance
     * @returns {Boolean}
     */


    static getIsNotPositive(instance) {
      assert.argumentIsRequired(instance, 'instance', Decimal, 'Decimal');
      return instance.getIsNegative() || instance.getIsZero();
    }
    /**
     * Runs {@link Decimal#getIsNegative} and returns the result.
     *
     * @public
     * @param {Decimal} instance
     * @returns {Boolean}
     */


    static getIsNegative(instance) {
      assert.argumentIsRequired(instance, 'instance', Decimal, 'Decimal');
      return instance.getIsNegative();
    }
    /**
     * Checks an instance to see if its positive or zero.
     *
     * @public
     * @param {Decimal} instance
     * @returns {Boolean}
     */


    static getIsNotNegative(instance) {
      assert.argumentIsRequired(instance, 'instance', Decimal, 'Decimal');
      return instance.getIsPositive() || instance.getIsZero();
    }
    /**
     * A comparator function for {@link Decimal} instances.
     *
     * @public
     * @param {Decimal} a
     * @param {Decimal} b
     * @returns {Number}
     */


    static compareDecimals(a, b) {
      assert.argumentIsRequired(a, 'a', Decimal, 'Decimal');
      assert.argumentIsRequired(b, 'b', Decimal, 'Decimal');

      if (a._big.gt(b._big)) {
        return 1;
      } else if (a._big.lt(b._big)) {
        return -1;
      } else {
        return 0;
      }
    }

    toString() {
      return '[Decimal]';
    }

  }

  const zero = new Big(0);
  const positiveOne = new Big(1);
  const negativeOne = new Big(-1);
  const decimalZero = new Decimal(zero);
  const decimalOne = new Decimal(positiveOne);
  const decimalNegativeOne = new Decimal(negativeOne);

  function getBig(value) {
    if (value instanceof Big) {
      return value;
    } else if (value instanceof Decimal) {
      return value._big;
    } else {
      return new Big(value);
    }
  }
  /**
   * An enumeration of strategies for rouding a {@link Decimal} instance.
   *
   * @public
   * @inner
   * @extends {Enum}
   */


  class RoundingMode extends Enum {
    constructor(value, description) {
      super(value.toString(), description);
      this._value = value;
    }
    /**
     * The code used by the Big.js library.
     *
     * @ignore
     * @returns {Number}
     */


    get value() {
      return this._value;
    }
    /**
     * Rounds away from zero.
     *
     * @public
     * @returns {RoundingMode}
     */


    static get UP() {
      return up;
    }
    /**
     * Rounds towards zero.
     *
     * @public
     * @returns {RoundingMode}
     */


    static get DOWN() {
      return down;
    }
    /**
     * Rounds towards nearest neighbor. If equidistant, rounds away from zero.
     *
     * @public
     * @returns {RoundingMode}
     */


    static get NORMAL() {
      return normal;
    }

    toString() {
      return '[RoundingMode]';
    }

  }

  const up = new RoundingMode(3, 'up');
  const down = new RoundingMode(0, 'down');
  const normal = new RoundingMode(1, 'normal');
  return Decimal;
})();

},{"./Enum":24,"./assert":30,"./is":36,"big.js":49}],23:[function(require,module,exports){
const assert = require('./assert');

module.exports = (() => {
  'use strict';
  /**
   * An object that has an end-of-life process.
   *
   * @public
   * @interface
   */

  class Disposable {
    constructor() {
      this._disposed = false;
    }
    /**
     * Invokes end-of-life logic. Once this function has been
     * invoked, further interaction with the object is not
     * recommended.
     *
     * @public
     */


    dispose() {
      if (this._disposed) {
        return;
      }

      this._disposed = true;

      this._onDispose();
    }
    /**
     * @protected
     * @abstract
     * @ignore
     */


    _onDispose() {
      return;
    }
    /**
     * Returns true if the {@link Disposable#dispose} function has been invoked.
     *
     * @public
     * @returns {boolean}
     */


    getIsDisposed() {
      return this._disposed || false;
    }

    toString() {
      return '[Disposable]';
    }
    /**
     * Creates and returns a {@link Disposable} object with end-of-life logic
     * delegated to a function.
     *
     * @public
     * @param disposeAction {Function}
     * @returns {Disposable}
     */


    static fromAction(disposeAction) {
      assert.argumentIsRequired(disposeAction, 'disposeAction', Function);
      return new DisposableAction(disposeAction);
    }
    /**
     * Creates and returns a {@link Disposable} object whose end-of-life
     * logic does nothing.
     *
     * @public
     * @returns {Disposable}
     */


    static getEmpty() {
      return Disposable.fromAction(() => {
        return;
      });
    }

  }

  class DisposableAction extends Disposable {
    constructor(disposeAction) {
      super(disposeAction);
      this._disposeAction = disposeAction;
    }

    _onDispose() {
      this._disposeAction();

      this._disposeAction = null;
    }

    toString() {
      return '[DisposableAction]';
    }

  }

  return Disposable;
})();

},{"./assert":30}],24:[function(require,module,exports){
const assert = require('./assert');

module.exports = (() => {
  'use strict';

  const types = new Map();
  /**
   * An enumeration. Must be inherited. Do not instantiate directly.
   * Also, this class uses the ES6 Map, therefore a polyfill must
   * be supplied.
   *
   * @public
   * @interface
   * @param {String} code - The unique code of the enumeration item.
   * @param {String} description - A description of the enumeration item.
   */

  class Enum {
    constructor(code, description) {
      assert.argumentIsRequired(code, 'code', String);
      assert.argumentIsRequired(description, 'description', String);
      this._code = code;
      this._description = description;
      const c = this.constructor;

      if (!types.has(c)) {
        types.set(c, []);
      }

      const existing = Enum.fromCode(c, code);

      if (existing === null) {
        types.get(c).push(this);
      }
    }
    /**
     * The unique code.
     *
     * @public
     * @returns {String}
     */


    get code() {
      return this._code;
    }
    /**
     * The description.
     *
     * @public
     * @returns {String}
     */


    get description() {
      return this._description;
    }
    /**
     * Returns true if the provided {@link Enum} argument is equal
     * to the instance.
     *
     * @public
     * @param {Enum} other
     * @returns {boolean}
     */


    equals(other) {
      return other === this || other instanceof Enum && other.constructor === this.constructor && other.code === this.code;
    }
    /**
     * Returns the JSON representation.
     *
     * @public
     * @returns {String}
     */


    toJSON() {
      return this.code;
    }
    /**
     * Looks up a enumeration item; given the enumeration type and the enumeration
     * item's value. If no matching item can be found, a null value is returned.
     *
     * @public
     * @param {Function} type - The enumeration type.
     * @param {String} code - The enumeration item's code.
     * @returns {*|null}
     */


    static fromCode(type, code) {
      return Enum.getItems(type).find(x => x.code === code) || null;
    }
    /**
     * Returns all of the enumeration's items (given an enumeration type).
     *
     * @public
     * @param {Function} type - The enumeration to list.
     * @returns {Array}
     */


    static getItems(type) {
      return types.get(type) || [];
    }

    toString() {
      return '[Enum]';
    }

  }

  return Enum;
})();

},{"./assert":30}],25:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

const Decimal = require('./Decimal'),
      Currency = require('./Currency');

module.exports = (() => {
  'use strict';
  /**
   * A structure for storing money amounts.
   *
   * @public
   * @param {Decimal|Number|String} - A amount, which can be parsed as a {@link Decimal}
   * @param {Currency} - The currency.
   */

  class Money {
    constructor(value, currency) {
      assert.argumentIsRequired(currency, 'currency', Currency, 'Currency');
      this._decimal = getDecimal(value);
      this._currency = currency;
    }
    /**
     * The currency amount.
     *
     * @public
     * @returns {Decimal}
     */


    get decimal() {
      return this._decimal;
    }
    /**
     * The currency.
     *
     * @public
     * @returns {Currency}
     */


    get currency() {
      return this._currency;
    }

    toAmount(places, mode) {
      return new Money(this._decimal.round(getPlaces(places), mode), this._currency);
    }
    /**
     * Returns the JSON representation.
     *
     * @public
     * @returns {Object}
     */


    toJSON() {
      return {
        decimal: this._decimal,
        currency: this._currency
      };
    }
    /**
     * Parses the value emitted by {@link Decimal#toJSON}.
     *
     * @public
     * @param {Object} value
     * @returns {Money}
     */


    static parse(value) {
      return new Money(value.decimal, value.currency);
    }

    toString() {
      return `[Money]`;
    }

  }

  function getDecimal(value) {
    if (value instanceof Decimal) {
      return value;
    } else {
      return new Decimal(value);
    }
  }

  function getPlaces(value) {
    if (is.integer(value) && !(value < 0)) {
      return value;
    } else {
      return 2;
    }
  }

  return Money;
})();

},{"./Currency":20,"./Decimal":22,"./assert":30,"./is":36}],26:[function(require,module,exports){
const assert = require('./assert'),
      memoize = require('./memoize');

const Currency = require('./Currency'),
      Decimal = require('./Decimal');

module.exports = (() => {
  'use strict';
  /**
   * A component that represents an exchange rate, composed of a {@link Decimal}
   * value and two currencies -- a quote (i.e. the numerator) currency and a
   * base (i.e. denominator) currency.
   *
   * @public
   * @param {Number|String|Decimal} value - The rate
   * @param {Currency} numerator - The quote currency
   * @param {Currency} denominator - The base currency
   */

  class Rate {
    constructor(value, numerator, denominator) {
      assert.argumentIsRequired(numerator, 'numerator', Currency, 'Currency');
      assert.argumentIsRequired(denominator, 'denominator', Currency, 'Currency');

      if (numerator === denominator) {
        throw new Error('A rate cannot use two identical currencies.');
      }

      const decimal = getDecimal(value);

      if (!decimal.getIsPositive()) {
        throw new Error('Rate value must be positive.');
      }

      this._decimal = decimal;
      this._numerator = numerator;
      this._denominator = denominator;
    }
    /**
     * The rate.
     *
     * @public
     * @returns {Decimal}
     */


    get decimal() {
      return this._decimal;
    }
    /**
     * The numerator (i.e. quote) currency. In other words,
     * this is EUR of the EURUSD pair.
     *
     * @public
     * @returns {Currency}
     */


    get numerator() {
      return this._numerator;
    }
    /**
     * The quote (i.e. numerator) currency. In other words,
     * this is EUR of the EURUSD pair.
     *
     * @public
     * @returns {Currency}
     */


    get quote() {
      return this._numerator;
    }
    /**
     * The denominator (i.e. base) currency. In other words,
     * this is USD of the EURUSD pair.
     *
     * @public
     * @returns {Currency}
     */


    get denominator() {
      return this._denominator;
    }
    /**
     * The base (i.e. denominator) currency. In other words,
     * this is USD of the EURUSD pair.
     *
     * @public
     * @returns {Currency}
     */


    get base() {
      return this._denominator;
    }
    /**
     * Returns the equivalent rate with the numerator and denominator (i.e. the qoute and base)
     * currencies.
     *
     * @public
     * @returns {Rate}
     */


    invert() {
      return new Rate(Decimal.ONE.divide(this._decimal), this._denominator, this._numerator);
    }
    /**
     * Formats the currency pair as a string (e.g. "EURUSD" or "^EURUSD").
     *
     * @public
     * @param {Boolean=} useCarat - If true, a carat is used as a prefix to the resulting string.
     * @returns {string}
     */


    formatPair(useCarat) {
      assert.argumentIsOptional(useCarat, 'useCarat', Boolean);
      return `${useCarat ? '^' : ''}${this._numerator}${this._denominator}`;
    }
    /**
     * Creates a {@link Rate} instance, when given a value
     *
     * @public
     * @param {Number|String|Decimal} value - The rate.
     * @param {String} symbol - A string that can be parsed as a currency pair.
     * @returns {Rate}
     */


    static fromPair(value, symbol) {
      assert.argumentIsRequired(symbol, 'symbol', String);
      const pair = parsePair(symbol);
      return new Rate(value, Currency.parse(pair.numerator), Currency.parse(pair.denominator));
    }
    /**
     * Given a {@link Decimal} value in a known currency, output
     * a {@link Decimal} converted to an alternate currency.
     *
     * @public
     * @param {Decimal} amount - The amount to convert.
     * @param {Currency} currency - The currency of the amount.
     * @param {Currency} desiredCurrency - The currency to convert to.
     * @param {...Rate} rates - A list of exchange rates to be used for the conversion.
     * @returns {Decimal}
     */


    static convert(amount, currency, desiredCurrency, ...rates) {
      assert.argumentIsRequired(amount, 'amount', Decimal, 'Decimal');
      assert.argumentIsRequired(currency, 'currency', Currency, 'Currency');
      assert.argumentIsRequired(desiredCurrency, 'desiredCurrency', Currency, 'Currency'); //assert.argumentIsArray(rates, 'rates', Rate, 'Rate');

      let converted;

      if (currency === desiredCurrency) {
        converted = amount;
      } else {
        const numerator = desiredCurrency;
        const denominator = currency;
        let rate = rates.find(r => r.numerator === numerator && r.denominator === denominator || r.numerator === denominator && r.denominator === numerator);

        if (rate) {
          if (rate.numerator === denominator) {
            rate = rate.invert();
          }
        }

        if (!rate) {
          throw new Error('Unable to perform conversion, given the rates provided.');
        }

        converted = amount.multiply(rate.decimal);
      }

      return converted;
    }

    toString() {
      return `[Rate]`;
    }

  }

  const pairExpression = /^\^?([A-Z]{3})([A-Z]{3})$/;

  function getDecimal(value) {
    if (value instanceof Decimal) {
      return value;
    } else {
      return new Decimal(value);
    }
  }

  const parsePair = memoize.simple(symbol => {
    const match = symbol.match(pairExpression);

    if (match === null) {
      throw new Error('The "pair" argument cannot be parsed.');
    }

    return {
      numerator: match[2],
      denominator: match[1]
    };
  });
  return Rate;
})();

},{"./Currency":20,"./Decimal":22,"./assert":30,"./memoize":39}],27:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

const moment = require('moment-timezone');

module.exports = (() => {
  'use strict';
  /**
   * A data structure encapsulates (and lazy loads) a moment (see https://momentjs.com/).
   *
   * @public
   * @param {Number} timestamp
   * @param {String=} timezone
   */

  class Timestamp {
    constructor(timestamp, timezone) {
      assert.argumentIsValid(timestamp, 'timestamp', is.large, 'is an integer');
      assert.argumentIsOptional(timezone, 'timezone', String);
      this._timestamp = timestamp;
      this._timezone = timezone || null;
      this._moment = null;
    }
    /**
     * The timestamp.
     *
     * @public
     * @returns {Number}
     */


    get timestamp() {
      return this._timestamp;
    }
    /**
     * The moment instance.
     *
     * @public
     * @returns {moment}
     */


    get moment() {
      if (this._moment === null) {
        this._moment = moment(this._timestamp);

        if (this._timezone !== null) {
          this.moment.tz(this._timezone);
        }
      }

      return this._moment;
    }
    /**
     * Returns the JSON representation.
     *
     * @public
     * @returns {Number}
     */


    toJSON() {
      return this.timestamp;
    }
    /**
     * Clones a {@link Timestamp} instance.
     *
     * @public
     * @static
     * @param {Timestamp} value
     * @returns {Timestamp}
     */


    static clone(value) {
      assert.argumentIsRequired(value, 'value', Timestamp, 'Timestamp');
      return new Timestamp(value._timestamp, value._timezone);
    }
    /**
     * Parses the value emitted by {@link Timestamp#toJSON}.
     *
     * @public
     * @param {Number} value
     * @returns {Timestamp}
     */


    static parse(value) {
      return new Timestamp(value);
    }
    /**
     * Returns a new {@link Timestamp} instance, representing the current moment.
     *
     * @public
     * @returns {Timestamp}
     */


    static now() {
      return new Timestamp(new Date().getTime());
    }

    toString() {
      return '[Timestamp]';
    }

  }

  return Timestamp;
})();

},{"./assert":30,"./is":36,"moment-timezone":52}],28:[function(require,module,exports){
const moment = require('moment-timezone/builds/moment-timezone-with-data-2012-2022');

const Enum = require('./Enum'),
      is = require('./is'),
      timezone = require('./timezone');

module.exports = (() => {
  'use strict';
  /**
   * An enumeration item that lists timezones, according to the common names
   * used in the tz database (see https://en.wikipedia.org/wiki/Tz_database).
   * The full list of names is sourced from moment.js; however, this wikipedia
   * article lists them: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
   *
   * @public
   * @param {String} code - The timezone name
   * @extends {Enum}
   */

  class Timezones extends Enum {
    constructor(code) {
      super(code, code);
    }
    /**
     * The timezone's offset from UTC, in minutes, at the moment of
     * the timestamp argument. If no timestamp if provided, the offset
     * from the current time is returned.
     *
     * @public
     * @param {Number=} timestamp
     * @returns {Number}
     */


    getUtcOffset(timestamp) {
      let timestampToUse;

      if (is.number(timestamp)) {
        timestampToUse = timestamp;
      } else {
        timestampToUse = new Date().getTime();
      }

      const offset = moment.tz.zone(this.code).utcOffset(timestampToUse);

      if (offset == 0) {
        return 0;
      } else {
        return offset * -1;
      }
    }
    /**
     *
     * Given a code, returns the enumeration item.
     *
     * @public
     * @param {String} code
     * @returns {Timezones|null}
     */


    static parse(code) {
      return Enum.fromCode(Timezones, code);
    }
    /**
     * UTC
     *
     * @public
     * @static
     * @returns {Timezones}
     */


    static get UTC() {
      return utc;
    }
    /**
     * America/Chicago
     *
     * @public
     * @static
     * @returns {Timezones}
     */


    static get AMERICA_CHICAGO() {
      return america_chicago;
    }
    /**
     * America/New_York
     *
     * @public
     * @static
     * @returns {Timezones}
     */


    static get AMERICA_NEW_YORK() {
      return america_new_york;
    }

    toString() {
      return `[Timezone (name=${this.code})]`;
    }

  }

  timezone.getTimezones().forEach(name => new Timezones(name));
  const utc = Enum.fromCode(Timezones, 'UTC');
  const america_chicago = Enum.fromCode(Timezones, 'America/Chicago');
  const america_new_york = Enum.fromCode(Timezones, 'America/New_York');
  return Timezones;
})();

},{"./Enum":24,"./is":36,"./timezone":44,"moment-timezone/builds/moment-timezone-with-data-2012-2022":50}],29:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

module.exports = (() => {
  'use strict';
  /**
   * Utilities for working with arrays.
   *
   * @public
   * @module lang/array
   */

  return {
    /**
     * Returns the unique items from an array, where the unique
     * key is determined via a strict equality check.
     *
     * @static
     * @param {Array} a
     * @returns {Array}
     */
    unique(a) {
      assert.argumentIsArray(a, 'a');
      return this.uniqueBy(a, item => item);
    },

    /**
     * Returns the unique items from an array, where the unique
     * key is determined by a delegate.
     *
     * @static
     * @param {Array} a
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Array}
     */
    uniqueBy(a, keySelector) {
      assert.argumentIsArray(a, 'a');
      return a.filter((item, index, array) => {
        const key = keySelector(item);
        return array.findIndex(candidate => key === keySelector(candidate)) === index;
      });
    },

    /**
     * Splits array into groups and returns an object (where the properties have
     * arrays). Unlike the indexBy function, there can be many items which share
     * the same key.
     *
     * @static
     * @param {Array} a
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Object}
     */
    groupBy(a, keySelector) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsRequired(keySelector, 'keySelector', Function);
      return a.reduce((groups, item) => {
        const key = keySelector(item);

        if (!groups.hasOwnProperty(key)) {
          groups[key] = [];
        }

        groups[key].push(item);
        return groups;
      }, {});
    },

    /**
     * Splits array into groups and returns an array of arrays where the items of each
     * nested array share a common key.
     *
     * @static
     * @param {Array} a
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Array}
     */
    batchBy(a, keySelector) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsRequired(keySelector, 'keySelector', Function);
      let currentKey = null;
      let currentBatch = null;
      return a.reduce((batches, item) => {
        const key = keySelector(item);

        if (currentBatch === null || currentKey !== key) {
          currentKey = key;
          currentBatch = [];
          batches.push(currentBatch);
        }

        currentBatch.push(item);
        return batches;
      }, []);
    },

    /**
     * Splits array into groups and returns an object (where the properties are items from the
     * original array). Unlike the groupBy, only one item can have a given key value.
     *
     * @static
     * @param {Array} a
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Object}
     */
    indexBy(a, keySelector) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsRequired(keySelector, 'keySelector', Function);
      return a.reduce((map, item) => {
        const key = keySelector(item);

        if (map.hasOwnProperty(key)) {
          throw new Error('Unable to index array. A duplicate key exists.');
        }

        map[key] = item;
        return map;
      }, {});
    },

    /**
     * Returns a new array containing all but the first item.
     *
     * @static
     * @param {Array} a
     * @returns {Array}
     */
    dropLeft(a) {
      assert.argumentIsArray(a, 'a');
      let returnRef = Array.from(a);

      if (returnRef.length !== 0) {
        returnRef.shift();
      }

      return returnRef;
    },

    /**
     * Returns a new array containing all but the last item.
     *
     * @static
     * @param {Array} a
     * @returns {Array}
     */
    dropRight(a) {
      assert.argumentIsArray(a, 'a');
      let returnRef = Array.from(a);

      if (returnRef.length !== 0) {
        returnRef.pop();
      }

      return returnRef;
    },

    /**
     * Returns the first item from an array, or an undefined value, if the
     * array is empty.
     *
     * @static
     * @param {Array} a
     * @returns {*|undefined}
     */
    first(a) {
      assert.argumentIsArray(a, 'a');
      let returnRef;

      if (a.length !== 0) {
        returnRef = a[0];
      } else {
        returnRef = undefined;
      }

      return returnRef;
    },

    /**
     * Returns the last item from an array, or an undefined value, if the
     * array is empty.
     *
     * @static
     * @param {Array} a
     * @returns {*|undefined}
     */
    last(a) {
      assert.argumentIsArray(a, 'a');
      let returnRef;

      if (a.length !== 0) {
        returnRef = a[a.length - 1];
      } else {
        returnRef = undefined;
      }

      return returnRef;
    },

    /**
     * Returns a copy of an array, replacing any item that is itself an array
     * with the item's items.
     *
     * @static
     * @param {Array} a
     * @param {Boolean=} recursive - If true, all nested arrays will be flattened.
     * @returns {Array}
     */
    flatten(a, recursive) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsOptional(recursive, 'recursive', Boolean);
      const empty = [];
      let flat = empty.concat.apply(empty, a);

      if (recursive && flat.some(x => is.array(x))) {
        flat = this.flatten(flat, true);
      }

      return flat;
    },

    /**
     * Breaks an array into smaller arrays, returning an array of arrays.
     *
     * @static
     * @param {Array} a
     * @param {Number} size - The maximum number of items per partition.
     * @param {Array<Array>}
     */
    partition(a, size) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsOptional(size, 'size', Number);
      const copy = a.slice(0);
      const partitions = [];

      while (copy.length !== 0) {
        partitions.push(copy.splice(0, size));
      }

      return partitions;
    },

    /**
     * Set difference operation (using strict equality).
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @returns {Array}
     */
    difference(a, b) {
      return this.differenceBy(a, b, item => item);
    },

    /**
     * Set difference operation, where the uniqueness is determined by a delegate.
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Array}
     */
    differenceBy(a, b, keySelector) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsArray(b, 'b');
      assert.argumentIsRequired(keySelector, 'keySelector', Function);
      const returnRef = [];
      a.forEach(candidate => {
        const candidateKey = keySelector(candidate);
        const exclude = b.some(comparison => candidateKey === keySelector(comparison));

        if (!exclude) {
          returnRef.push(candidate);
        }
      });
      return returnRef;
    },

    /**
     * Set symmetric difference operation (using strict equality). In
     * other words, this is the union of the differences between the
     * sets.
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @returns {Array}
     */
    differenceSymmetric(a, b) {
      return this.differenceSymmetricBy(a, b, item => item);
    },

    /**
     * Set symmetric difference operation, where the uniqueness is determined by a delegate.
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Array}
     */
    differenceSymmetricBy(a, b, keySelector) {
      return this.unionBy(this.differenceBy(a, b, keySelector), this.differenceBy(b, a, keySelector), keySelector);
    },

    /**
     * Set union operation (using strict equality).
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @returns {Array}
     */
    union(a, b) {
      return this.unionBy(a, b, item => item);
    },

    /**
     * Set union operation, where the uniqueness is determined by a delegate.
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Array}
     */
    unionBy(a, b, keySelector) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsArray(b, 'b');
      assert.argumentIsRequired(keySelector, 'keySelector', Function);
      const returnRef = a.slice();
      b.forEach(candidate => {
        const candidateKey = keySelector(candidate);
        const exclude = returnRef.some(comparison => candidateKey === keySelector(comparison));

        if (!exclude) {
          returnRef.push(candidate);
        }
      });
      return returnRef;
    },

    /**
     * Set intersection operation (using strict equality).
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @returns {Array}
     */
    intersection(a, b) {
      return this.intersectionBy(a, b, item => item);
    },

    /**
     * Set intersection operation, where the uniqueness is determined by a delegate.
     *
     * @static
     * @param {Array} a
     * @param {Array} b
     * @param {Function} keySelector - A function that returns a unique key for an item.
     * @returns {Array}
     */
    intersectionBy(a, b, keySelector) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsArray(b, 'b');
      const returnRef = [];
      a.forEach(candidate => {
        const candidateKey = keySelector(candidate);
        const include = b.some(comparison => candidateKey === keySelector(comparison));

        if (include) {
          returnRef.push(candidate);
        }
      });
      return returnRef;
    },

    /**
     * Removes the first item from an array which matches a predicate.
     *
     * @static
     * @public
     * @param {Array} a
     * @param {Function} predicate
     * @returns {Boolean}
     */
    remove(a, predicate) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsRequired(predicate, 'predicate', Function);
      const index = a.findIndex(predicate);
      const found = !(index < 0);

      if (found) {
        a.splice(index, 1);
      }

      return found;
    },

    /**
     * Inserts an item into an array using a binary search is used to determine the
     * proper point for insertion and returns the same array.
     *
     * @static
     * @public
     * @param {Array} a
     * @param {*} item
     * @param {Function} comparator
     * @returns {Array}
     */
    insert(a, item, comparator) {
      assert.argumentIsArray(a, 'a');
      assert.argumentIsRequired(comparator, 'comparator', Function);

      if (a.length === 0 || !(comparator(item, a[a.length - 1]) < 0)) {
        a.push(item);
      } else if (comparator(item, a[0]) < 0) {
        a.unshift(item);
      } else {
        a.splice(binarySearch(a, item, comparator, 0, a.length - 1), 0, item);
      }

      return a;
    }

  };

  function binarySearch(array, item, comparator, start, end) {
    const size = end - start;
    const midpointIndex = start + Math.floor(size / 2);
    const midpointItem = array[midpointIndex];
    const comparison = comparator(item, midpointItem) > 0;

    if (size < 2) {
      if (comparison > 0) {
        const finalIndex = array.length - 1;

        if (end === finalIndex && comparator(item, array[finalIndex]) > 0) {
          return end + 1;
        } else {
          return end;
        }
      } else {
        return start;
      }
    } else if (comparison > 0) {
      return binarySearch(array, item, comparator, midpointIndex, end);
    } else {
      return binarySearch(array, item, comparator, start, midpointIndex);
    }
  }
})();

},{"./assert":30,"./is":36}],30:[function(require,module,exports){
const is = require('./is');

module.exports = (() => {
  'use strict';

  function checkArgumentType(variable, variableName, type, typeDescription, index) {
    if (type === String) {
      if (!is.string(variable)) {
        throwInvalidTypeError(variableName, 'string', index);
      }
    } else if (type === Number) {
      if (!is.number(variable)) {
        throwInvalidTypeError(variableName, 'number', index);
      }
    } else if (type === Function) {
      if (!is.fn(variable)) {
        throwInvalidTypeError(variableName, 'function', index);
      }
    } else if (type === Boolean) {
      if (!is.boolean(variable)) {
        throwInvalidTypeError(variableName, 'boolean', index);
      }
    } else if (type === Date) {
      if (!is.date(variable)) {
        throwInvalidTypeError(variableName, 'date', index);
      }
    } else if (type === Array) {
      if (!is.array(variable)) {
        throwInvalidTypeError(variableName, 'array', index);
      }
    } else if (!(variable instanceof (type || Object))) {
      throwInvalidTypeError(variableName, typeDescription, index);
    }
  }

  function throwInvalidTypeError(variableName, typeDescription, index) {
    let message;

    if (typeof index === 'number') {
      message = `The argument [ ${variableName || 'unspecified'} ], at index [ ${index.toString()} ] must be a [ ${typeDescription || 'unknown'} ]`;
    } else {
      message = `The argument [ ${variableName || 'unspecified'} ] must be a [ ${typeDescription || 'Object'} ]`;
    }

    throw new Error(message);
  }

  function throwCustomValidationError(variableName, predicateDescription) {
    throw new Error(`The argument [ ${variableName || 'unspecified'} ] failed a validation check [ ${predicateDescription || 'No description available'} ]`);
  }
  /**
   * Utilities checking arguments.
   *
   * @public
   * @module lang/assert
   */


  return {
    /**
     * Throws an error if an argument doesn't conform to the desired specification (as
     * determined by a type check).
     *
     * @static
     * @param {*} variable - The value to check.
     * @param {String} variableName - The name of the value (used for formatting an error message).
     * @param {*} type - The expected type of the argument.
     * @param {String=} typeDescription - The description of the expected type (used for formatting an error message).
     */
    argumentIsRequired(variable, variableName, type, typeDescription) {
      checkArgumentType(variable, variableName, type, typeDescription);
    },

    /**
     * A relaxed version of the "argumentIsRequired" function that will not throw if
     * the value is undefined or null.
     *
     * @static
     * @param {*} variable - The value to check.
     * @param {String} variableName - The name of the value (used for formatting an error message).
     * @param {*} type - The expected type of the argument.
     * @param {String=} typeDescription - The description of the expected type (used for formatting an error message).
     */
    argumentIsOptional(variable, variableName, type, typeDescription, predicate, predicateDescription) {
      if (variable === null || variable === undefined) {
        return;
      }

      checkArgumentType(variable, variableName, type, typeDescription);

      if (is.fn(predicate) && !predicate(variable)) {
        throwCustomValidationError(variableName, predicateDescription);
      }
    },

    argumentIsArray(variable, variableName, itemConstraint, itemConstraintDescription) {
      this.argumentIsRequired(variable, variableName, Array);

      if (itemConstraint) {
        let itemValidator;

        if (typeof itemConstraint === 'function' && itemConstraint !== Function) {
          itemValidator = (value, index) => itemConstraint.prototype !== undefined && value instanceof itemConstraint || itemConstraint(value, `${variableName}[${index}]`);
        } else {
          itemValidator = (value, index) => checkArgumentType(value, variableName, itemConstraint, itemConstraintDescription, index);
        }

        variable.forEach((v, i) => {
          itemValidator(v, i);
        });
      }
    },

    /**
     * Throws an error if an argument doesn't conform to the desired specification
     * (as determined by a predicate).
     *
     * @static
     * @param {*} variable - The value to check.
     * @param {String} variableName - The name of the value (used for formatting an error message).
     * @param {Function=} predicate - A function used to validate the item (beyond type checking).
     * @param {String=} predicateDescription - A description of the assertion made by the predicate (e.g. "is an integer") that is used for formatting an error message.
     */
    argumentIsValid(variable, variableName, predicate, predicateDescription) {
      if (!predicate(variable)) {
        throwCustomValidationError(variableName, predicateDescription);
      }
    },

    areEqual(a, b, descriptionA, descriptionB) {
      if (a !== b) {
        throw new Error(`The objects must be equal [${descriptionA || a.toString()}] and [${descriptionB || b.toString()}]`);
      }
    },

    areNotEqual(a, b, descriptionA, descriptionB) {
      if (a === b) {
        throw new Error(`The objects cannot be equal [${descriptionA || a.toString()}] and [${descriptionB || b.toString()}]`);
      }
    }

  };
})();

},{"./is":36}],31:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

module.exports = (() => {
  'use strict';

  function getPropertyNameArray(propertyNames, separator = '.') {
    let returnRef;

    if (is.array(propertyNames)) {
      returnRef = propertyNames;
    } else {
      returnRef = propertyNames.split(separator);
    }

    return returnRef;
  }

  function getPropertyTarget(target, propertyNameArray, create) {
    let returnRef;
    let propertyTarget = target;

    for (let i = 0; i < propertyNameArray.length - 1; i++) {
      let propertyName = propertyNameArray[i];

      if (propertyTarget.hasOwnProperty(propertyName) && !is.null(propertyTarget[propertyName]) && !is.undefined(propertyTarget[propertyName])) {
        propertyTarget = propertyTarget[propertyName];
      } else if (create) {
        propertyTarget = propertyTarget[propertyName] = {};
      } else {
        propertyTarget = null;
        break;
      }
    }

    return propertyTarget;
  }

  function last(array) {
    if (array.length !== 0) {
      return array[array.length - 1];
    } else {
      return null;
    }
  }
  /**
   * Utilities for reading and writing "complex" properties to
   * objects. For example, the property "name.first" reads the
   * "first" property on the "name" object of the target.
   *
   * @public
   * @module lang/attributes
   */


  return {
    /**
     * Checks to see if an attribute exists on the target object.
     *
     * @public
     * @static
     * @param {Object} target - The object to check for existence of the property.
     * @param {String|String[]} propertyNames - The property to check -- either a string with separators, or an array of strings (already split by separator).
     * @param {String=} separator - The separator (defaults to a period character).
     * @returns {boolean}
     */
    has(target, propertyNames, separator) {
      assert.argumentIsRequired(target, 'target', Object);

      if (is.array(propertyNames)) {
        assert.argumentIsArray(propertyNames, 'propertyNames', String);
      } else {
        assert.argumentIsRequired(propertyNames, 'propertyNames', String);
      }

      const propertyNameArray = getPropertyNameArray(propertyNames, separator);
      const propertyTarget = getPropertyTarget(target, propertyNameArray, false);
      return propertyTarget !== null && propertyTarget.hasOwnProperty(last(propertyNameArray));
    },

    /**
     * Returns a value from the target object. If the property doesn't exist; undefined
     * is returned.
     *
     * @public
     * @static
     * @param {Object} target - The object to read from.
     * @param {String|String[]} propertyNames - The property to read -- either a string with separators, or an array of strings (already split by separator).
     * @param {String=} separator - The separator (defaults to a period character).
     * @returns {*}
     */
    read(target, propertyNames, separator) {
      assert.argumentIsRequired(target, 'target', Object);

      if (is.array(propertyNames)) {
        assert.argumentIsArray(propertyNames, 'propertyNames', String);
      } else {
        assert.argumentIsRequired(propertyNames, 'propertyNames', String);
      }

      const propertyNameArray = getPropertyNameArray(propertyNames, separator);
      const propertyTarget = getPropertyTarget(target, propertyNameArray, false);
      let returnRef;

      if (propertyTarget) {
        const propertyName = last(propertyNameArray);
        returnRef = propertyTarget[propertyName];
      } else {
        returnRef = undefined;
      }

      return returnRef;
    },

    /**
     * Writes a value to the target object.
     *
     * @public
     * @static
     * @param {Object} target - The object to write to.
     * @param {String|String[]} propertyNames - The property to write -- either a string with separators, or an array of strings (already split by separator).
     * @param {*} value - The value to assign.
     * @param {String=} separator - The separator (defaults to a period character).
     */
    write(target, propertyNames, value, separator) {
      assert.argumentIsRequired(target, 'target', Object);

      if (is.array(propertyNames)) {
        assert.argumentIsArray(propertyNames, 'propertyNames', String);
      } else {
        assert.argumentIsRequired(propertyNames, 'propertyNames', String);
      }

      const propertyNameArray = getPropertyNameArray(propertyNames, separator);
      const propertyTarget = getPropertyTarget(target, propertyNameArray, true);
      const propertyName = last(propertyNameArray);
      propertyTarget[propertyName] = value;
    },

    /**
     * Erases a property from the target object.
     *
     * @public
     * @static
     * @param {Object} target - The object to erase a property from.
     * @param {String|String} propertyNames - The property to write -- either a string with separators, or an array of strings (already split by separator).
     * @param {String=} separator - The separator (defaults to a period character).
     */
    erase(target, propertyNames, separator) {
      if (!this.has(target, propertyNames)) {
        return;
      }

      const propertyNameArray = getPropertyNameArray(propertyNames, separator);
      const propertyTarget = getPropertyTarget(target, propertyNameArray, true);
      const propertyName = last(propertyNameArray);
      delete propertyTarget[propertyName];
    }

  };
})();

},{"./assert":30,"./is":36}],32:[function(require,module,exports){
const is = require('./is');

module.exports = (() => {
  'use strict';
  /**
   * Utilities checking HTTP connections.
   *
   * @public
   * @module lang/connection
   * @deprecated
   */

  return {
    /**
     * Returns true, if the input is a true boolean value; otherwise false.
     *
     * @param {Boolean=} secure
     * @returns {Boolean}
     */
    getIsSecure(secure) {
      return is.boolean(secure) && secure;
    }

  };
})();

},{"./is":36}],33:[function(require,module,exports){
module.exports = (() => {
  'use strict';

  const utilities = {
    getShortDay(date) {
      const day = date.getDay();
      return days[day].short;
    },

    getDate(date) {
      return date.getDate();
    },

    getDateOrdinal(date) {
      const d = utilities.getDate(date);
      const remainder = d % 10;
      let returnRef;

      if (remainder === 1 && d !== 11) {
        returnRef = 'st';
      } else if (remainder === 2 && d !== 12) {
        returnRef = 'nd';
      } else if (remainder === 3 && d !== 13) {
        returnRef = 'rd';
      } else {
        returnRef = 'th';
      }

      return returnRef;
    },

    getShortMonth(date) {
      const month = date.getMonth();
      return months[month].short;
    },

    getYear(date) {
      return date.getFullYear();
    }

  };
  const days = [{
    short: 'Sun'
  }, {
    short: 'Mon'
  }, {
    short: 'Tue'
  }, {
    short: 'Wed'
  }, {
    short: 'Thu'
  }, {
    short: 'Fri'
  }, {
    short: 'Sat'
  }];
  const months = [{
    short: 'Jan'
  }, {
    short: 'Feb'
  }, {
    short: 'Mar'
  }, {
    short: 'Apr'
  }, {
    short: 'May'
  }, {
    short: 'Jun'
  }, {
    short: 'Jul'
  }, {
    short: 'Aug'
  }, {
    short: 'Sep'
  }, {
    short: 'Oct'
  }, {
    short: 'Nov'
  }, {
    short: 'Dec'
  }];
  return utilities;
})();

},{}],34:[function(require,module,exports){
module.exports = (() => {
  'use strict';

  return {
    /**
     * Formats a number into a string for display purposes.
     */
    numberToString(value, digits, thousandsSeparator, useParenthesis) {
      if (value === '' || value === undefined || value === null || isNaN(value)) {
        return '';
      }

      const applyParenthesis = value < 0 && useParenthesis === true;

      if (applyParenthesis) {
        value = 0 - value;
      }

      let returnRef = value.toFixed(digits);

      if (thousandsSeparator && !(value > -1000 && value < 1000)) {
        const length = returnRef.length;
        const negative = value < 0;
        let found = digits === 0;
        let counter = 0;
        const buffer = [];

        for (let i = length - 1; !(i < 0); i--) {
          if (counter === 3 && !(negative && i === 0)) {
            buffer.unshift(thousandsSeparator);
            counter = 0;
          }

          const character = returnRef.charAt(i);
          buffer.unshift(character);

          if (found) {
            counter = counter + 1;
          } else if (character === '.') {
            found = true;
          }
        }

        if (applyParenthesis) {
          buffer.unshift('(');
          buffer.push(')');
        }

        returnRef = buffer.join('');
      } else if (applyParenthesis) {
        returnRef = '(' + returnRef + ')';
      }

      return returnRef;
    }

  };
})();

},{}],35:[function(require,module,exports){
module.exports = (() => {
  'use strict';

  function tautology(x) {
    return x;
  }

  function empty() {
    return;
  }
  /**
   * Utilities for working with functions.
   *
   * @public
   * @module lang/functions
   */


  return {
    /**
     * A function that returns the first argument passed.
     *
     * @static
     * @returns {Function}
     */
    getTautology() {
      return tautology;
    },

    /**
     * A function with no return value.
     *
     * @static
     * @returns {Function}
     */
    getEmpty() {
      return empty;
    }

  };
})();

},{}],36:[function(require,module,exports){
module.exports = (() => {
  'use strict';
  /**
   * Utilities for interrogating variables (e.g. checking data types).
   *
   * @public
   * @module lang/is
   */

  return {
    /**
     * Returns true, if the argument is a number. NaN will return false.
     *
     * @static
     * @public
     * @param {*} candidate {*}
     * @returns {boolean}
     */
    number(candidate) {
      return typeof candidate === 'number' && !isNaN(candidate);
    },

    /**
     * Returns true, if the argument is NaN.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    nan(candidate) {
      return typeof candidate === 'number' && isNaN(candidate);
    },

    /**
     * Returns true, if the argument is a valid 32-bit integer.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    integer(candidate) {
      return typeof candidate === 'number' && !isNaN(candidate) && (candidate | 0) === candidate;
    },

    /**
     * Returns true, if the argument is a valid integer (which can exceed 32 bits); however,
     * the check can fail above the value of Number.MAX_SAFE_INTEGER.
     *
     * @static
     * @public
     * @param {*) candidate
     * @returns {boolean}
     */
    large(candidate) {
      return typeof candidate === 'number' && !isNaN(candidate) && isFinite(candidate) && Math.floor(candidate) === candidate;
    },

    /**
     * Returns true, if the argument is a number that is positive.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    positive(candidate) {
      return this.number(candidate) && candidate > 0;
    },

    /**
     * Returns true, if the argument is a number that is negative.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    negative(candidate) {
      return this.number(candidate) && candidate < 0;
    },

    /**
     * Returns true, if the argument is a string.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    string(candidate) {
      return typeof candidate === 'string';
    },

    /**
     * Returns true, if the argument is a JavaScript Date instance.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    date(candidate) {
      return candidate instanceof Date;
    },

    /**
     * Returns true, if the argument is a function.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    fn(candidate) {
      return typeof candidate === 'function';
    },

    /**
     * Returns true, if the argument is an array.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    array(candidate) {
      return Array.isArray(candidate);
    },

    /**
     * Returns true, if the argument is a Boolean value.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    boolean(candidate) {
      return typeof candidate === 'boolean';
    },

    /**
     * Returns true, if the argument is an object.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    object(candidate) {
      return typeof candidate === 'object' && candidate !== null;
    },

    /**
     * Returns true, if the argument is a null value.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    null(candidate) {
      return candidate === null;
    },

    /**
     * Returns true, if the argument is an undefined value.
     *
     * @static
     * @public
     * @param {*} candidate
     * @returns {boolean}
     */
    undefined(candidate) {
      return candidate === undefined;
    },

    /**
     * Given two classes, determines if the "child" class extends
     * the "parent" class (without instantiation).
     *
     * @param {Function} parent
     * @param {Function} child
     * @returns {Boolean}
     */
    extension(parent, child) {
      return this.fn(parent) && this.fn(child) && child.prototype instanceof parent;
    }

  };
})();

},{}],37:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

module.exports = (() => {
  'use strict';

  const mask = {
    getEmpty() {
      return 0;
    },

    add(existing, itemToAdd) {
      assert.argumentIsRequired(existing, 'existing', Number);
      assert.argumentIsRequired(itemToAdd, 'itemToAdd', Number);

      if (mask.checkItem(itemToAdd)) {
        return existing | itemToAdd;
      } else {
        return existing;
      }
    },

    remove(existing, itemToRemove) {
      assert.argumentIsRequired(existing, 'existing', Number);
      assert.argumentIsRequired(itemToRemove, 'itemToRemove', Number);

      if (mask.checkItem(itemToRemove)) {
        return existing & ~itemToRemove;
      } else {
        return existing;
      }
    },

    has(existing, itemToCheck) {
      assert.argumentIsRequired(existing, 'existing', Number);
      assert.argumentIsRequired(itemToCheck, 'itemToCheck', Number);
      return mask.checkItem(itemToCheck) && (existing & itemToCheck) === itemToCheck;
    },

    checkItem(itemToCheck) {
      return is.number(itemToCheck) && (itemToCheck === 0 || (itemToCheck & ~itemToCheck + 1) === itemToCheck);
    }

  };
  return mask;
})();

},{"./assert":30,"./is":36}],38:[function(require,module,exports){
const is = require('./is');

module.exports = (() => {
  'use strict';

  return {
    approximate(a, b) {
      if (!is.number(a) || !is.number(b)) {
        return false;
      }

      if (a == b) {
        return true;
      }

      if (isFinite(a) && isFinite(b)) {
        const absoluteDifference = Math.abs(a - b);

        if (absoluteDifference < Number.EPSILON) {
          return true;
        } else {
          return !(absoluteDifference > Math.max(Math.abs(a), Math.abs(b)) * Number.EPSILON);
        }
      } else {
        return false;
      }
    }

  };
})();

},{"./is":36}],39:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

module.exports = (() => {
  'use strict';
  /**
   * Utilities for caching results of function invocations (a.k.a. memoization).
   *
   * @public
   * @module lang/memoize
   */

  return {
    /**
     * Memoizes a function that accepts a single argument only. Furthermore,
     * the parameter's toString function must return a unique value.
     *
     * @static
     * @public
     * @param {Function} fn - The function to memoize. This function should accept one parameters whose "toString" function outputs a unique value.
     */
    simple(fn) {
      const cache = {};
      return x => {
        if (cache.hasOwnProperty(x)) {
          return cache[x];
        } else {
          return cache[x] = fn(x);
        }
      };
    },

    /**
     * Wraps a function. The resulting function will call the wrapped function
     * once and cache the result. If a specific duration is supplied, the
     * cache will be dropped after the duration expires and the wrapped
     * function will be invoked again.
     *
     * @public
     * @param {Function} fn
     * @param {Number} duration
     * @returns {Function}
     */
    cache(fn, duration) {
      assert.argumentIsRequired(fn, 'fn', Function);
      assert.argumentIsOptional(duration, 'duration', Number);
      const durationToUse = duration || 0;
      let executionTime = null;
      let cacheResult = null;
      return () => {
        const currentTime = new Date().getTime();

        if (executionTime === null || durationToUse > 0 && currentTime > executionTime + durationToUse) {
          executionTime = currentTime;
          cacheResult = fn();
        }

        return cacheResult;
      };
    }

  };
})();

},{"./assert":30,"./is":36}],40:[function(require,module,exports){
const array = require('./array'),
      is = require('./is');

module.exports = (() => {
  'use strict';
  /**
   * Utilities for working with objects.
   *
   * @public
   * @module lang/object
   */

  const object = {
    /**
     * Performs "deep" equality check on two objects.
     *
     * Array items are compared, object properties are compared, and
     * "primitive" values are checked using strict equality rules.
     *
     * @static
     * @param {Object} a
     * @param {Object} b
     * @returns {Boolean}
     */
    equals(a, b) {
      let returnVal;

      if (a === b) {
        returnVal = true;
      } else if (is.array(a) && is.array(b)) {
        if (a.length === b.length) {
          returnVal = a.length === 0 || a.every((x, i) => object.equals(x, b[i]));
        } else {
          returnVal = false;
        }
      } else if (is.object(a) && is.object(b)) {
        if (is.fn(a.equals) && is.fn(b.equals)) {
          returnVal = a.equals(b);
        } else {
          const keysA = object.keys(a);
          const keysB = object.keys(b);
          returnVal = array.differenceSymmetric(keysA, keysB).length === 0 && keysA.every(key => {
            const valueA = a[key];
            const valueB = b[key];
            return object.equals(valueA, valueB);
          });
        }
      } else {
        returnVal = false;
      }

      return returnVal;
    },

    /**
     * Performs a "deep" copy.
     *
     * @static
     * @param {Object} source - The object to copy.
     * @param {Function=} canExtract - An optional function which indicates if the "extractor" can be used.
     * @param {Function=} extractor - An optional function which returns a cloned value for a property for assignment to the cloned object.
     * @returns {Object}
     */
    clone(source, canExtract, extractor) {
      let c;

      if (is.fn(canExtract) && canExtract(source)) {
        c = extractor(source);
      } else if (is.array(source)) {
        c = source.map(sourceItem => {
          return object.clone(sourceItem, canExtract, extractor);
        });
      } else if (is.object(source)) {
        c = object.keys(source).reduce((accumulator, key) => {
          accumulator[key] = object.clone(source[key], canExtract, extractor);
          return accumulator;
        }, {});
      } else {
        c = source;
      }

      return c;
    },

    /**
     * Creates a new object (or array) by performing a deep copy
     * of the properties from each object. If the same property
     * exists on both objects, the property value from the
     * second object ("b") is preferred.
     *
     * @static
     * @param {Object} a
     * @param {Object} b
     * @returns {Object}
     */
    merge(a, b) {
      let m;
      const mergeTarget = is.object(a) && !is.array(a);
      const mergeSource = is.object(b) && !is.array(b);

      if (mergeTarget && mergeSource) {
        const properties = array.unique(object.keys(a).concat(object.keys(b)));
        m = properties.reduce((accumulator, property) => {
          accumulator[property] = object.merge(a[property], b[property]);
          return accumulator;
        }, {});
      } else if (is.undefined(b)) {
        m = object.clone(a);
      } else {
        m = object.clone(b);
      }

      return m;
    },

    /**
     * Given an object, returns an array of "own" properties.
     *
     * @static
     * @param {Object} target - The object to interrogate.
     * @returns {Array<string>}
     */
    keys(target) {
      const keys = [];

      for (let k in target) {
        if (target.hasOwnProperty(k)) {
          keys.push(k);
        }
      }

      return keys;
    },

    /**
     * Given an object, returns a Boolean value, indicating if the
     * object has any "own" properties.
     *
     * @static
     * @param {Object} target - The object to interrogate.
     * @returns {Boolean}
     */
    empty(target) {
      let empty = true;

      for (let k in target) {
        if (target.hasOwnProperty(k)) {
          empty = false;
          break;
        }
      }

      return empty;
    }

  };
  return object;
})();

},{"./array":29,"./is":36}],41:[function(require,module,exports){
const assert = require('./assert');

module.exports = (() => {
  'use strict';
  /**
   * Utilities for working with promises.
   *
   * @public
   * @module lang/promise
   */

  return {
    timeout(promise, timeout) {
      return Promise.resolve().then(() => {
        assert.argumentIsRequired(promise, 'promise', Promise, 'Promise');
        assert.argumentIsRequired(timeout, 'timeout', Number);

        if (!(timeout > 0)) {
          throw new Error('Promise timeout must be greater than zero.');
        }

        return this.build((resolveCallback, rejectCallback) => {
          let pending = true;
          let token = setTimeout(() => {
            if (pending) {
              pending = false;
              rejectCallback(`Promise timed out after ${timeout} milliseconds`);
            }
          }, timeout);
          promise.then(result => {
            if (pending) {
              pending = false;
              clearTimeout(token);
              resolveCallback(result);
            }
          }).catch(error => {
            if (pending) {
              pending = false;
              clearTimeout(token);
              rejectCallback(error);
            }
          });
        });
      });
    },

    /**
     * A mapping function that works asynchronously. Given an array of items, each item through
     * a mapping function, which can return a promise. Then, this function returns a single promise
     * which is the result of each mapped promise.
     *
     * @public
     * @static
     * @param {Array} items - The items to map
     * @param {Function} mapper - The mapping function (e.g. given an item, return a promise).
     * @param {Number} concurrency - The maximum number of promises that are allowed to run at once.
     * @returns {Promise<Array>}
     */
    map(items, mapper, concurrency) {
      return Promise.resolve().then(() => {
        assert.argumentIsArray(items, 'items');
        assert.argumentIsRequired(mapper, 'mapper', Function);
        assert.argumentIsOptional(concurrency, 'concurrency', Number);
        const c = Math.max(0, concurrency || 0);
        let mapPromise;

        if (c === 0 || items.length === 0) {
          mapPromise = Promise.all(items.map(item => Promise.resolve(mapper(item))));
        } else {
          let total = items.length;
          let active = 0;
          let complete = 0;
          let failure = false;
          const results = Array.of(total);
          const executors = items.map((item, index) => {
            return () => {
              return Promise.resolve().then(() => {
                return mapper(item);
              }).then(result => {
                results[index] = result;
              });
            };
          });
          mapPromise = this.build((resolveCallback, rejectCallback) => {
            const execute = () => {
              if (!(executors.length > 0 && c > active && !failure)) {
                return;
              }

              active = active + 1;
              const executor = executors.shift();
              executor().then(() => {
                if (failure) {
                  return;
                }

                active = active - 1;
                complete = complete + 1;

                if (complete < total) {
                  execute();
                } else {
                  resolveCallback(results);
                }
              }).catch(error => {
                failure = false;
                rejectCallback(error);
              });
              execute();
            };

            execute();
          });
        }

        return mapPromise;
      });
    },

    /**
     * Runs a series of functions sequentially (where each function can be
     * synchronous or asynchronous). The result of each function is passed
     * to the successive function and the result of the final function is
     * returned to the consumer.
     *
     * @static
     * @public
     * @param {Function[]} functions - An array of functions, each expecting a single argument.
     * @param input - The argument to pass the first function.
     * @returns {Promise<TResult>}
     */
    pipeline(functions, input) {
      return Promise.resolve().then(() => {
        assert.argumentIsArray(functions, 'functions', Function);
        return functions.reduce((previous, fn) => previous.then(result => fn(result)), Promise.resolve(input));
      });
    },

    /**
     * Creates a new promise, given an executor.
     *
     * This is a wrapper for the {@link Promise} constructor; however, any error
     * is caught and the resulting promise is rejected (instead of letting the
     * error bubble up to the top-level handler).
     *
     * @public
     * @static
     * @param {Function} executor - A function which has two callback parameters. The first is used to resolve the promise, the second rejects it.
     * @returns {Promise}
     */
    build(executor) {
      return new Promise((resolve, reject) => {
        try {
          executor(resolve, reject);
        } catch (e) {
          reject(e);
        }
      });
    }

  };
})();

},{"./assert":30}],42:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

module.exports = (() => {
  'use strict';

  return {
    range(minimum, maximum) {
      assert.argumentIsRequired(minimum, 'minimum', Number);
      assert.argumentIsRequired(maximum, 'maximum', Number);
      const mn = Math.trunc(minimum);
      const mx = Math.trunc(maximum);
      return Math.min(mn, mx) + Math.floor(Math.random() * Math.abs(mx - mn));
    }

  };
})();

},{"./assert":30,"./is":36}],43:[function(require,module,exports){
const assert = require('./assert'),
      is = require('./is');

module.exports = (() => {
  'use strict';
  /**
   * Utility functions for strings.
   *
   * @public
   * @module lang/string
   */

  return {
    startCase(s) {
      return s.split(' ').reduce((phrase, word) => {
        if (word.length !== 0) {
          phrase.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
        }

        return phrase;
      }, []).join(' ');
    },

    /**
     * If a string exceeds a desired length, it is truncated and a poor man's
     * ellipsis (i.e. three periods) is appended. Otherwise, the original
     * string is returned.
     *
     * @public
     * @static
     * @param {String} s
     * @param {Number} length
     * @returns {String}
     */
    truncate(s, length) {
      if (is.string(s) && s.length > length) {
        return s.substring(0, length) + ' ...';
      } else {
        return s;
      }
    },

    /**
     * Adds leading characters to a string, until the string length is a desired size.
     *
     * @public
     * @static
     * @param {String} s - The string to pad.
     * @param {Number} length - The desired overall length of the string.
     * @param {String} character - The character to use for padding.
     * @returns {String}
     */
    padLeft(s, length, character) {
      assert.argumentIsRequired(s, 's', String);
      assert.argumentIsRequired(length, 'length', Number);
      assert.argumentIsRequired(character, 'character', String);

      if (character.length !== 1) {
        throw new Error('The "character" argument must be one character in length.');
      }

      return character.repeat(length - s.length) + s;
    },

    /**
     * Performs a simple token replacement on a string; where the tokens
     * are braced numbers (e.g. {0}, {1}, {2}).
     *
     * @public
     * @static
     * @param {String} s - The string to format (e.g. 'my first name is {0} and my last name is {1}')
     * @param {Array<String>} data - The replacement data
     * @returns {String}
     */
    format(s, ...data) {
      assert.argumentIsRequired(s, 's', String);
      return s.replace(/{(\d+)}/g, (match, i) => {
        let replacement;

        if (i < data.length) {
          const item = data[i];

          if (!is.undefined(item) && !is.null(item)) {
            replacement = item.toString();
          } else {
            replacement = match;
          }
        } else {
          replacement = match;
        }

        return replacement;
      });
    }

  };
})();

},{"./assert":30,"./is":36}],44:[function(require,module,exports){
const moment = require('moment-timezone/builds/moment-timezone-with-data-2012-2022'),
      assert = require('./assert');

module.exports = (() => {
  'use strict';
  /**
   * Utilities for working with timezones.
   *
   * @public
   * @module lang/timezone
   */

  return {
    /**
     * Gets a list of names in the tz database (see https://en.wikipedia.org/wiki/Tz_database
     * and https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).
     *
     * @static
     * @returns {Array<String>}
     */
    getTimezones() {
      return moment.tz.names();
    },

    /**
     * Indicates if a timezone name exists.
     *
     * @static
     * @param {String} name - The timezone name to find.
     * @returns {Boolean}
     */
    hasTimezone(name) {
      assert.argumentIsRequired(name, 'name', String);
      return this.getTimezones().some(candidate => {
        return candidate === name;
      });
    },

    /**
     * Attempts to guess the lock timezone.
     *
     * @returns {String|null}
     */
    guessTimezone() {
      return moment.tz.guess() || null;
    }

  };
})();

},{"./assert":30,"moment-timezone/builds/moment-timezone-with-data-2012-2022":50}],45:[function(require,module,exports){
const assert = require('./../lang/assert'),
      Disposable = require('./../lang/Disposable');

module.exports = (() => {
  'use strict';
  /**
   * An implementation of the observer pattern.
   *
   * @param {*} sender - The object which owns the event.
   * @extends {Disposable}
   */

  class Event extends Disposable {
    constructor(sender) {
      super();
      this._sender = sender || null;
      this._observers = [];
    }
    /**
     * Registers an event handler which will receive a notification when
     * {@link Event#fire} is called.
     *
     * @public
     * @param {Function} handler - The function which will be called each time the event fires. The first argument will be the event data. The second argument will be the event owner (i.e. sender).
     * @returns {Disposable}
     */


    register(handler) {
      assert.argumentIsRequired(handler, 'handler', Function);
      addRegistration.call(this, handler);
      return Disposable.fromAction(() => {
        if (this.getIsDisposed()) {
          return;
        }

        removeRegistration.call(this, handler);
      });
    }
    /**
     * Removes registration for an event handler. That is, the handler will
     * no longer be called if the event fires.
     *
     * @public
     * @param {Function} handler
     */


    unregister(handler) {
      assert.argumentIsRequired(handler, 'handler', Function);
      removeRegistration.call(this, handler);
    }
    /**
     * Removes all handlers from the event.
     *
     * @public
     */


    clear() {
      this._observers = [];
    }
    /**
     * Triggers the event, calling all previously registered handlers.
     *
     * @public
     * @param {*) data - The data to pass each handler.
     */


    fire(data) {
      let observers = this._observers;

      for (let i = 0; i < observers.length; i++) {
        let observer = observers[i];
        observer(data, this._sender);
      }
    }
    /**
     * Returns true, if no handlers are currently registered.
     *
     * @returns {boolean}
     */


    getIsEmpty() {
      return this._observers.length === 0;
    }

    _onDispose() {
      this._observers = null;
    }

    toString() {
      return '[Event]';
    }

  }

  function addRegistration(handler) {
    let copiedObservers = this._observers.slice();

    copiedObservers.push(handler);
    this._observers = copiedObservers;
  }

  function removeRegistration(handler) {
    const indicesToRemove = [];

    for (let i = 0; i < this._observers.length; i++) {
      let candidate = this._observers[i];

      if (candidate === handler) {
        indicesToRemove.push(i);
      }
    }

    if (indicesToRemove.length > 0) {
      const copiedObservers = this._observers.slice();

      for (let j = indicesToRemove.length - 1; !(j < 0); j--) {
        copiedObservers.splice(indicesToRemove[j], 1);
      }

      this._observers = copiedObservers;
    }
  }

  return Event;
})();

},{"./../lang/Disposable":23,"./../lang/assert":30}],46:[function(require,module,exports){
const assert = require('./../lang/assert'),
      Disposable = require('./../lang/Disposable'),
      Event = require('./Event');

module.exports = (() => {
  'use strict';
  /**
   * A container for {@link Event} instances where each event is
   * keyed by name.
   *
   * @public
   * @extends {Disposable}
   */

  class EventMap extends Disposable {
    constructor() {
      super();
      this._events = {};
    }
    /**
     * Fires the appropriate event which is mapped to the event name.
     * See {@link Event#fire} for more information.
     *
     * @public
     * @param {String} eventName - The event's name.
     * @param {*} data - The data to provide to observers.
     */


    fire(eventName, data) {
      const event = this._events[eventName];

      if (event) {
        event.fire(data);
      }
    }
    /**
     * Registers a handler. See {@link Event#register} for more information.
     *
     * @public
     * @param {String} eventName - The event's name.
     * @param {Function} handler
     */


    register(eventName, handler) {
      assert.argumentIsRequired(eventName, 'eventName', String);

      if (this.getIsDisposed()) {
        throw new Error('The event has been disposed.');
      }

      let event = this._events[eventName];

      if (!event) {
        event = this._events[eventName] = new Event(this);
      }

      return event.register(handler);
    }
    /**
     * Removes a handler. See {@link Event#unregister} for more information.
     *
     * @public
     * @param {String} eventName - The event's name.
     * @param {Function} handler
     */


    unregister(eventName, handler) {
      assert.argumentIsRequired(eventName, 'eventName', String);
      const event = this._events[eventName];

      if (event) {
        event.unregister(handler);

        if (event.getIsEmpty()) {
          delete this._events[eventName];
        }
      }
    }
    /**
     * Clears an event's handlers. See {@link Event#clear} for more information.
     *
     * @public
     * @param {String} eventName - The event's name.
     */


    clear(eventName) {
      assert.argumentIsRequired(eventName, 'eventName', String);
      const event = this._events[eventName];

      if (event) {
        event.clear();
        delete this._events[eventName];
      }
    }
    /**
     * Returns true, if no handlers are currently registered for the
     * specified event. See {@link Event#getIsEmpty} for more information.
     *
     * @returns {boolean}
     */


    getIsEmpty(eventName) {
      const event = this._events[eventName];
      let returnVal;

      if (event) {
        returnVal = event.getIsEmpty();
      } else {
        returnVal = true;
      }

      return returnVal;
    }
    /**
     * Returns an array of all the event names.
     *
     * @returns {Array<String>}
     */


    getKeys() {
      const keys = [];

      for (let key in this._events) {
        if (this._events.hasOwnProperty(key)) {
          keys.push(key);
        }
      }

      return keys;
    }
    /**
     * Returns true, if an event with the given name exists.
     *
     * @param {String} key
     * @returns {boolean}
     */


    hasKey(key) {
      return this._events.hasOwnProperty(key);
    }

    _onDispose() {
      let keys = this.getKeys();

      for (let i = 0; i < keys.length; i++) {
        let key = keys[i];

        this._events[key].dispose();
      }

      this._events = {};
    }

    toString() {
      return '[EventMap]';
    }

  }

  return EventMap;
})();

},{"./../lang/Disposable":23,"./../lang/assert":30,"./Event":45}],47:[function(require,module,exports){
const assert = require('./../lang/assert'),
      is = require('./../lang/is'),
      Disposable = require('./../lang/Disposable'),
      Event = require('./../messaging/Event');

module.exports = (() => {
  'use strict';

  class Model extends Disposable {
    constructor(propertyNames, propertyObservers, equalityPredicates) {
      super();
      this._propertyNames = propertyNames;
      this._transactionCommit = new Event(this);
      this._transactionOpen = false;
      this._transactionData = null;
      this._trackerOpen = false;
      this._trackerData = null;
      this._sequence = 0;
      const observers = propertyObservers || {};
      const predicates = equalityPredicates || {};

      for (let i = 0; i < this._propertyNames.length; i++) {
        const propertyName = propertyNames[i];
        createProperty.call(this, propertyName, observers[propertyName] || emptyFunction, predicates[propertyName] || checkEquals);
      }
    }

    beginTransaction() {
      if (this._transactionOpen) {
        return;
      }

      this._transactionOpen = true;
    }

    endTransaction() {
      if (!this._transactionOpen) {
        return;
      }

      if (this.getIsDisposed()) {
        return;
      }

      this._transactionOpen = false;

      if (this._transactionData !== null) {
        this._formatTransactionData(this._transactionData);

        this._transactionData.sequence = this._sequence++;

        if (this._trackerOpen) {
          this._trackerData = this._trackerData || {};

          for (let propertyName in this._transactionData) {
            this._trackerData[propertyName] = this._transactionData[propertyName];
          }
        }

        this._transactionCommit.fire(this._transactionData);

        this._transactionData = null;
      }
    }

    _formatTransactionData(transactionData) {
      return;
    }

    executeTransaction(processor) {
      assert.argumentIsRequired(processor, 'processor', Function);
      this.beginTransaction();
      processor(this);
      this.endTransaction();
    }

    onTransactionCommitted(observer) {
      if (this.getIsDisposed()) {
        return;
      }

      return this._transactionCommit.register(observer);
    }

    startTracker() {
      if (this._trackerOpen) {
        return;
      }

      this._trackerOpen = true;
    }

    resetTracker() {
      if (!this._trackerOpen) {
        return null;
      }

      if (this.getIsDisposed()) {
        return null;
      }

      const returnRef = this._trackerData;
      this._trackerData = null;
      return returnRef;
    }

    stopTracking() {
      if (!this._trackerOpen) {
        return;
      }

      if (this.getIsDisposed()) {
        return;
      }

      this._trackerOpen = false;
      this._trackerData = null;
    }

    getSnapshot() {
      const snapshot = {};

      for (let i = 0; i < this._propertyNames.length; i++) {
        const propertyName = this._propertyNames[i];
        snapshot[propertyName] = this[propertyName];
      }

      snapshot.sequence = this._sequence;
      return snapshot;
    }

    _onDispose() {
      this._transactionCommit.dispose();

      this._transactionCommit = null;
    }

    toString() {
      return '[Model]';
    }

  }

  function emptyFunction() {
    return;
  }

  function checkEquals(a, b) {
    return a === b;
  }

  function createProperty(propertyName, propertyObserver, equalityPredicate) {
    let propertyValue = null;
    Object.defineProperty(this, propertyName, {
      get: () => {
        return propertyValue;
      },
      set: value => {
        const valueToAssign = is.undefined(value) ? null : value;

        if (equalityPredicate(propertyValue, valueToAssign)) {
          return;
        }

        propertyValue = valueToAssign;
        const implicit = !this._transactionOpen;

        if (implicit) {
          this.beginTransaction();
        }

        this._transactionData = this._transactionData || {};
        this._transactionData[propertyName] = propertyValue;
        propertyObserver(this);

        if (implicit) {
          this.endTransaction();
        }
      }
    });
  }

  return Model;
})();

},{"./../lang/Disposable":23,"./../lang/assert":30,"./../lang/is":36,"./../messaging/Event":45}],48:[function(require,module,exports){
const assert = require('./../../lang/assert');

const RestParser = require('./RestParser');

const Schema = require('./../../serialization/json/Schema');

module.exports = (() => {
  'use strict';
  /**
   * Parses the response received by a {@link RestProviderBase}, the
   * default implementation simply returns the response string.
   *
   * @public
   */

  class RestParser {
    constructor() {}
    /**
     * Parses a response.
     *
     * @public
     * @param {String=} response.
     * @returns {*}
     */


    parse(response) {
      assert.argumentIsOptional(response, 'response', String);
      return this._parse(response);
    }
    /**
     * @protected
     * @abstract
     * @ignore
     */


    _parse(response) {
      return response;
    }
    /**
     * Returns a {@link RestParser} that does nothing -- it just returns
     * the response string that it is given.
     *
     * @public
     * @returns {RestParser}
     */


    static get DEFAULT() {
      return restParserDefault;
    }
    /**
     * Returns a {@link RestParser} parses the response string as JSON.
     *
     * @public
     * @returns {RestParser}
     */


    static get JSON() {
      return restParserJson;
    }
    /**
     * Returns a {@link RestParser} parses the does customized JSON parsing
     * using a "reviver" function.
     *
     * @public
     * @param {Function} reviverFactory - A function that returns a JSON.parse reviver function
     * @returns {RestParser}
     */


    static getJsonParser(reviverFactory) {
      return new DelegatedRestParser(x => JSON.parse(x, reviverFactory()));
    }
    /**
     * Returns a {@link RestParser} parses the does customized JSON parsing
     * based on a JSON {@link Schema}.
     *
     * @public
     * @param {Schema} schema
     * @returns {RestParser}
     */


    static getJsonParserForSchema(schema) {
      assert.argumentIsRequired(schema, 'schema', Schema, 'Schema');
      return RestParser.getJsonParser(schema.getReviverFactory());
    }

    toString() {
      return '[RestParser]';
    }

  }

  class DelegatedRestParser extends RestParser {
    constructor(delegate) {
      super();
      assert.argumentIsRequired(delegate, 'delegate', Function);
      this._delegate = delegate;
    }

    _parse(response) {
      return this._delegate(response);
    }

    toString() {
      return '[DelegatedRestParser]';
    }

  }

  const restParserDefault = new RestParser();
  const restParserJson = new DelegatedRestParser(x => JSON.parse(x));
  return RestParser;
})();

},{"./../../lang/assert":30,"./../../serialization/json/Schema":58,"./RestParser":48}],49:[function(require,module,exports){
/*
 *  big.js v5.0.3
 *  A small, fast, easy-to-use library for arbitrary-precision decimal arithmetic.
 *  Copyright (c) 2017 Michael Mclaughlin <M8ch88l@gmail.com>
 *  https://github.com/MikeMcl/big.js/LICENCE
 */
;(function (GLOBAL) {
  'use strict';
  var Big,


/************************************** EDITABLE DEFAULTS *****************************************/


    // The default values below must be integers within the stated ranges.

    /*
     * The maximum number of decimal places (DP) of the results of operations involving division:
     * div and sqrt, and pow with negative exponents.
     */
    DP = 20,          // 0 to MAX_DP

    /*
     * The rounding mode (RM) used when rounding to the above decimal places.
     *
     *  0  Towards zero (i.e. truncate, no rounding).       (ROUND_DOWN)
     *  1  To nearest neighbour. If equidistant, round up.  (ROUND_HALF_UP)
     *  2  To nearest neighbour. If equidistant, to even.   (ROUND_HALF_EVEN)
     *  3  Away from zero.                                  (ROUND_UP)
     */
    RM = 1,             // 0, 1, 2 or 3

    // The maximum value of DP and Big.DP.
    MAX_DP = 1E6,       // 0 to 1000000

    // The maximum magnitude of the exponent argument to the pow method.
    MAX_POWER = 1E6,    // 1 to 1000000

    /*
     * The negative exponent (NE) at and beneath which toString returns exponential notation.
     * (JavaScript numbers: -7)
     * -1000000 is the minimum recommended exponent value of a Big.
     */
    NE = -7,            // 0 to -1000000

    /*
     * The positive exponent (PE) at and above which toString returns exponential notation.
     * (JavaScript numbers: 21)
     * 1000000 is the maximum recommended exponent value of a Big.
     * (This limit is not enforced or checked.)
     */
    PE = 21,            // 0 to 1000000


/**************************************************************************************************/


    // Error messages.
    NAME = '[big.js] ',
    INVALID = NAME + 'Invalid ',
    INVALID_DP = INVALID + 'decimal places',
    INVALID_RM = INVALID + 'rounding mode',
    DIV_BY_ZERO = NAME + 'Division by zero',

    // The shared prototype object.
    P = {},
    UNDEFINED = void 0,
    NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;


  /*
   * Create and return a Big constructor.
   *
   */
  function _Big_() {

    /*
     * The Big constructor and exported function.
     * Create and return a new instance of a Big number object.
     *
     * n {number|string|Big} A numeric value.
     */
    function Big(n) {
      var x = this;

      // Enable constructor usage without new.
      if (!(x instanceof Big)) return n === UNDEFINED ? _Big_() : new Big(n);

      // Duplicate.
      if (n instanceof Big) {
        x.s = n.s;
        x.e = n.e;
        x.c = n.c.slice();
      } else {
        parse(x, n);
      }

      /*
       * Retain a reference to this Big constructor, and shadow Big.prototype.constructor which
       * points to Object.
       */
      x.constructor = Big;
    }

    Big.prototype = P;
    Big.DP = DP;
    Big.RM = RM;
    Big.NE = NE;
    Big.PE = PE;
    Big.version = '5.0.2';

    return Big;
  }


  /*
   * Parse the number or string value passed to a Big constructor.
   *
   * x {Big} A Big number instance.
   * n {number|string} A numeric value.
   */
  function parse(x, n) {
    var e, i, nl;

    // Minus zero?
    if (n === 0 && 1 / n < 0) n = '-0';
    else if (!NUMERIC.test(n += '')) throw Error(INVALID + 'number');

    // Determine sign.
    x.s = n.charAt(0) == '-' ? (n = n.slice(1), -1) : 1;

    // Decimal point?
    if ((e = n.indexOf('.')) > -1) n = n.replace('.', '');

    // Exponential form?
    if ((i = n.search(/e/i)) > 0) {

      // Determine exponent.
      if (e < 0) e = i;
      e += +n.slice(i + 1);
      n = n.substring(0, i);
    } else if (e < 0) {

      // Integer.
      e = n.length;
    }

    nl = n.length;

    // Determine leading zeros.
    for (i = 0; i < nl && n.charAt(i) == '0';) ++i;

    if (i == nl) {

      // Zero.
      x.c = [x.e = 0];
    } else {

      // Determine trailing zeros.
      for (; nl > 0 && n.charAt(--nl) == '0';);
      x.e = e - i - 1;
      x.c = [];

      // Convert string to array of digits without leading/trailing zeros.
      for (e = 0; i <= nl;) x.c[e++] = +n.charAt(i++);
    }

    return x;
  }


  /*
   * Round Big x to a maximum of dp decimal places using rounding mode rm.
   * Called by stringify, P.div, P.round and P.sqrt.
   *
   * x {Big} The Big to round.
   * dp {number} Integer, 0 to MAX_DP inclusive.
   * rm {number} 0, 1, 2 or 3 (DOWN, HALF_UP, HALF_EVEN, UP)
   * [more] {boolean} Whether the result of division was truncated.
   */
  function round(x, dp, rm, more) {
    var xc = x.c,
      i = x.e + dp + 1;

    if (i < xc.length) {
      if (rm === 1) {

        // xc[i] is the digit after the digit that may be rounded up.
        more = xc[i] >= 5;
      } else if (rm === 2) {
        more = xc[i] > 5 || xc[i] == 5 &&
          (more || i < 0 || xc[i + 1] !== UNDEFINED || xc[i - 1] & 1);
      } else if (rm === 3) {
        more = more || xc[i] !== UNDEFINED || i < 0;
      } else {
        more = false;
        if (rm !== 0) throw Error(INVALID_RM);
      }

      if (i < 1) {
        xc.length = 1;

        if (more) {

          // 1, 0.1, 0.01, 0.001, 0.0001 etc.
          x.e = -dp;
          xc[0] = 1;
        } else {

          // Zero.
          xc[0] = x.e = 0;
        }
      } else {

        // Remove any digits after the required decimal places.
        xc.length = i--;

        // Round up?
        if (more) {

          // Rounding up may mean the previous digit has to be rounded up.
          for (; ++xc[i] > 9;) {
            xc[i] = 0;
            if (!i--) {
              ++x.e;
              xc.unshift(1);
            }
          }
        }

        // Remove trailing zeros.
        for (i = xc.length; !xc[--i];) xc.pop();
      }
    } else if (rm < 0 || rm > 3 || rm !== ~~rm) {
      throw Error(INVALID_RM);
    }

    return x;
  }


  /*
   * Return a string representing the value of Big x in normal or exponential notation.
   * Handles P.toExponential, P.toFixed, P.toJSON, P.toPrecision, P.toString and P.valueOf.
   *
   * x {Big}
   * id? {number} Caller id.
   *         1 toExponential
   *         2 toFixed
   *         3 toPrecision
   *         4 valueOf
   * n? {number|undefined} Caller's argument.
   * k? {number|undefined}
   */
  function stringify(x, id, n, k) {
    var e, s,
      Big = x.constructor,
      z = !x.c[0];

    if (n !== UNDEFINED) {
      if (n !== ~~n || n < (id == 3) || n > MAX_DP) {
        throw Error(id == 3 ? INVALID + 'precision' : INVALID_DP);
      }

      x = new Big(x);

      // The index of the digit that may be rounded up.
      n = k - x.e;

      // Round?
      if (x.c.length > ++k) round(x, n, Big.RM);

      // toFixed: recalculate k as x.e may have changed if value rounded up.
      if (id == 2) k = x.e + n + 1;

      // Append zeros?
      for (; x.c.length < k;) x.c.push(0);
    }

    e = x.e;
    s = x.c.join('');
    n = s.length;

    // Exponential notation?
    if (id != 2 && (id == 1 || id == 3 && k <= e || e <= Big.NE || e >= Big.PE)) {
      s = s.charAt(0) + (n > 1 ? '.' + s.slice(1) : '') + (e < 0 ? 'e' : 'e+') + e;

    // Normal notation.
    } else if (e < 0) {
      for (; ++e;) s = '0' + s;
      s = '0.' + s;
    } else if (e > 0) {
      if (++e > n) for (e -= n; e--;) s += '0';
      else if (e < n) s = s.slice(0, e) + '.' + s.slice(e);
    } else if (n > 1) {
      s = s.charAt(0) + '.' + s.slice(1);
    }

    return x.s < 0 && (!z || id == 4) ? '-' + s : s;
  }


  // Prototype/instance methods


  /*
   * Return a new Big whose value is the absolute value of this Big.
   */
  P.abs = function () {
    var x = new this.constructor(this);
    x.s = 1;
    return x;
  };


  /*
   * Return 1 if the value of this Big is greater than the value of Big y,
   *       -1 if the value of this Big is less than the value of Big y, or
   *        0 if they have the same value.
  */
  P.cmp = function (y) {
    var isneg,
      x = this,
      xc = x.c,
      yc = (y = new x.constructor(y)).c,
      i = x.s,
      j = y.s,
      k = x.e,
      l = y.e;

    // Either zero?
    if (!xc[0] || !yc[0]) return !xc[0] ? !yc[0] ? 0 : -j : i;

    // Signs differ?
    if (i != j) return i;

    isneg = i < 0;

    // Compare exponents.
    if (k != l) return k > l ^ isneg ? 1 : -1;

    j = (k = xc.length) < (l = yc.length) ? k : l;

    // Compare digit by digit.
    for (i = -1; ++i < j;) {
      if (xc[i] != yc[i]) return xc[i] > yc[i] ^ isneg ? 1 : -1;
    }

    // Compare lengths.
    return k == l ? 0 : k > l ^ isneg ? 1 : -1;
  };


  /*
   * Return a new Big whose value is the value of this Big divided by the value of Big y, rounded,
   * if necessary, to a maximum of Big.DP decimal places using rounding mode Big.RM.
   */
  P.div = function (y) {
    var x = this,
      Big = x.constructor,
      a = x.c,                  // dividend
      b = (y = new Big(y)).c,   // divisor
      k = x.s == y.s ? 1 : -1,
      dp = Big.DP;

    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);

    // Divisor is zero?
    if (!b[0]) throw Error(DIV_BY_ZERO);

    // Dividend is 0? Return +-0.
    if (!a[0]) return new Big(k * 0);

    var bl, bt, n, cmp, ri,
      bz = b.slice(),
      ai = bl = b.length,
      al = a.length,
      r = a.slice(0, bl),   // remainder
      rl = r.length,
      q = y,                // quotient
      qc = q.c = [],
      qi = 0,
      d = dp + (q.e = x.e - y.e) + 1;    // number of digits of the result

    q.s = k;
    k = d < 0 ? 0 : d;

    // Create version of divisor with leading zero.
    bz.unshift(0);

    // Add zeros to make remainder as long as divisor.
    for (; rl++ < bl;) r.push(0);

    do {

      // n is how many times the divisor goes into current remainder.
      for (n = 0; n < 10; n++) {

        // Compare divisor and remainder.
        if (bl != (rl = r.length)) {
          cmp = bl > rl ? 1 : -1;
        } else {
          for (ri = -1, cmp = 0; ++ri < bl;) {
            if (b[ri] != r[ri]) {
              cmp = b[ri] > r[ri] ? 1 : -1;
              break;
            }
          }
        }

        // If divisor < remainder, subtract divisor from remainder.
        if (cmp < 0) {

          // Remainder can't be more than 1 digit longer than divisor.
          // Equalise lengths using divisor with extra leading zero?
          for (bt = rl == bl ? b : bz; rl;) {
            if (r[--rl] < bt[rl]) {
              ri = rl;
              for (; ri && !r[--ri];) r[ri] = 9;
              --r[ri];
              r[rl] += 10;
            }
            r[rl] -= bt[rl];
          }

          for (; !r[0];) r.shift();
        } else {
          break;
        }
      }

      // Add the digit n to the result array.
      qc[qi++] = cmp ? n : ++n;

      // Update the remainder.
      if (r[0] && cmp) r[rl] = a[ai] || 0;
      else r = [a[ai]];

    } while ((ai++ < al || r[0] !== UNDEFINED) && k--);

    // Leading zero? Do not remove if result is simply zero (qi == 1).
    if (!qc[0] && qi != 1) {

      // There can't be more than one zero.
      qc.shift();
      q.e--;
    }

    // Round?
    if (qi > d) round(q, dp, Big.RM, r[0] !== UNDEFINED);

    return q;
  };


  /*
   * Return true if the value of this Big is equal to the value of Big y, otherwise return false.
   */
  P.eq = function (y) {
    return !this.cmp(y);
  };


  /*
   * Return true if the value of this Big is greater than the value of Big y, otherwise return
   * false.
   */
  P.gt = function (y) {
    return this.cmp(y) > 0;
  };


  /*
   * Return true if the value of this Big is greater than or equal to the value of Big y, otherwise
   * return false.
   */
  P.gte = function (y) {
    return this.cmp(y) > -1;
  };


  /*
   * Return true if the value of this Big is less than the value of Big y, otherwise return false.
   */
  P.lt = function (y) {
    return this.cmp(y) < 0;
  };


  /*
   * Return true if the value of this Big is less than or equal to the value of Big y, otherwise
   * return false.
   */
  P.lte = function (y) {
    return this.cmp(y) < 1;
  };


  /*
   * Return a new Big whose value is the value of this Big minus the value of Big y.
   */
  P.minus = P.sub = function (y) {
    var i, j, t, xlty,
      x = this,
      Big = x.constructor,
      a = x.s,
      b = (y = new Big(y)).s;

    // Signs differ?
    if (a != b) {
      y.s = -b;
      return x.plus(y);
    }

    var xc = x.c.slice(),
      xe = x.e,
      yc = y.c,
      ye = y.e;

    // Either zero?
    if (!xc[0] || !yc[0]) {

      // y is non-zero? x is non-zero? Or both are zero.
      return yc[0] ? (y.s = -b, y) : new Big(xc[0] ? x : 0);
    }

    // Determine which is the bigger number. Prepend zeros to equalise exponents.
    if (a = xe - ye) {

      if (xlty = a < 0) {
        a = -a;
        t = xc;
      } else {
        ye = xe;
        t = yc;
      }

      t.reverse();
      for (b = a; b--;) t.push(0);
      t.reverse();
    } else {

      // Exponents equal. Check digit by digit.
      j = ((xlty = xc.length < yc.length) ? xc : yc).length;

      for (a = b = 0; b < j; b++) {
        if (xc[b] != yc[b]) {
          xlty = xc[b] < yc[b];
          break;
        }
      }
    }

    // x < y? Point xc to the array of the bigger number.
    if (xlty) {
      t = xc;
      xc = yc;
      yc = t;
      y.s = -y.s;
    }

    /*
     * Append zeros to xc if shorter. No need to add zeros to yc if shorter as subtraction only
     * needs to start at yc.length.
     */
    if ((b = (j = yc.length) - (i = xc.length)) > 0) for (; b--;) xc[i++] = 0;

    // Subtract yc from xc.
    for (b = i; j > a;) {
      if (xc[--j] < yc[j]) {
        for (i = j; i && !xc[--i];) xc[i] = 9;
        --xc[i];
        xc[j] += 10;
      }

      xc[j] -= yc[j];
    }

    // Remove trailing zeros.
    for (; xc[--b] === 0;) xc.pop();

    // Remove leading zeros and adjust exponent accordingly.
    for (; xc[0] === 0;) {
      xc.shift();
      --ye;
    }

    if (!xc[0]) {

      // n - n = +0
      y.s = 1;

      // Result must be zero.
      xc = [ye = 0];
    }

    y.c = xc;
    y.e = ye;

    return y;
  };


  /*
   * Return a new Big whose value is the value of this Big modulo the value of Big y.
   */
  P.mod = function (y) {
    var ygtx,
      x = this,
      Big = x.constructor,
      a = x.s,
      b = (y = new Big(y)).s;

    if (!y.c[0]) throw Error(DIV_BY_ZERO);

    x.s = y.s = 1;
    ygtx = y.cmp(x) == 1;
    x.s = a;
    y.s = b;

    if (ygtx) return new Big(x);

    a = Big.DP;
    b = Big.RM;
    Big.DP = Big.RM = 0;
    x = x.div(y);
    Big.DP = a;
    Big.RM = b;

    return this.minus(x.times(y));
  };


  /*
   * Return a new Big whose value is the value of this Big plus the value of Big y.
   */
  P.plus = P.add = function (y) {
    var t,
      x = this,
      Big = x.constructor,
      a = x.s,
      b = (y = new Big(y)).s;

    // Signs differ?
    if (a != b) {
      y.s = -b;
      return x.minus(y);
    }

    var xe = x.e,
      xc = x.c,
      ye = y.e,
      yc = y.c;

    // Either zero? y is non-zero? x is non-zero? Or both are zero.
    if (!xc[0] || !yc[0]) return yc[0] ? y : new Big(xc[0] ? x : a * 0);

    xc = xc.slice();

    // Prepend zeros to equalise exponents.
    // Note: Faster to use reverse then do unshifts.
    if (a = xe - ye) {
      if (a > 0) {
        ye = xe;
        t = yc;
      } else {
        a = -a;
        t = xc;
      }

      t.reverse();
      for (; a--;) t.push(0);
      t.reverse();
    }

    // Point xc to the longer array.
    if (xc.length - yc.length < 0) {
      t = yc;
      yc = xc;
      xc = t;
    }

    a = yc.length;

    // Only start adding at yc.length - 1 as the further digits of xc can be left as they are.
    for (b = 0; a; xc[a] %= 10) b = (xc[--a] = xc[a] + yc[a] + b) / 10 | 0;

    // No need to check for zero, as +x + +y != 0 && -x + -y != 0

    if (b) {
      xc.unshift(b);
      ++ye;
    }

    // Remove trailing zeros.
    for (a = xc.length; xc[--a] === 0;) xc.pop();

    y.c = xc;
    y.e = ye;

    return y;
  };


  /*
   * Return a Big whose value is the value of this Big raised to the power n.
   * If n is negative, round to a maximum of Big.DP decimal places using rounding
   * mode Big.RM.
   *
   * n {number} Integer, -MAX_POWER to MAX_POWER inclusive.
   */
  P.pow = function (n) {
    var x = this,
      one = new x.constructor(1),
      y = one,
      isneg = n < 0;

    if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) throw Error(INVALID + 'exponent');
    if (isneg) n = -n;

    for (;;) {
      if (n & 1) y = y.times(x);
      n >>= 1;
      if (!n) break;
      x = x.times(x);
    }

    return isneg ? one.div(y) : y;
  };


  /*
   * Return a new Big whose value is the value of this Big rounded to a maximum of dp decimal
   * places using rounding mode rm.
   * If dp is not specified, round to 0 decimal places.
   * If rm is not specified, use Big.RM.
   *
   * dp? {number} Integer, 0 to MAX_DP inclusive.
   * rm? 0, 1, 2 or 3 (ROUND_DOWN, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_UP)
   */
  P.round = function (dp, rm) {
    var Big = this.constructor;
    if (dp === UNDEFINED) dp = 0;
    else if (dp !== ~~dp || dp < 0 || dp > MAX_DP) throw Error(INVALID_DP);
    return round(new Big(this), dp, rm === UNDEFINED ? Big.RM : rm);
  };


  /*
   * Return a new Big whose value is the square root of the value of this Big, rounded, if
   * necessary, to a maximum of Big.DP decimal places using rounding mode Big.RM.
   */
  P.sqrt = function () {
    var r, c, t,
      x = this,
      Big = x.constructor,
      s = x.s,
      e = x.e,
      half = new Big(0.5);

    // Zero?
    if (!x.c[0]) return new Big(x);

    // Negative?
    if (s < 0) throw Error(NAME + 'No square root');

    // Estimate.
    s = Math.sqrt(x.toString());

    // Math.sqrt underflow/overflow?
    // Re-estimate: pass x to Math.sqrt as integer, then adjust the result exponent.
    if (s === 0 || s === 1 / 0) {
      c = x.c.join('');
      if (!(c.length + e & 1)) c += '0';
      r = new Big(Math.sqrt(c).toString());
      r.e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
    } else {
      r = new Big(s.toString());
    }

    e = r.e + (Big.DP += 4);

    // Newton-Raphson iteration.
    do {
      t = r;
      r = half.times(t.plus(x.div(t)));
    } while (t.c.slice(0, e).join('') !== r.c.slice(0, e).join(''));

    return round(r, Big.DP -= 4, Big.RM);
  };


  /*
   * Return a new Big whose value is the value of this Big times the value of Big y.
   */
  P.times = P.mul = function (y) {
    var c,
      x = this,
      Big = x.constructor,
      xc = x.c,
      yc = (y = new Big(y)).c,
      a = xc.length,
      b = yc.length,
      i = x.e,
      j = y.e;

    // Determine sign of result.
    y.s = x.s == y.s ? 1 : -1;

    // Return signed 0 if either 0.
    if (!xc[0] || !yc[0]) return new Big(y.s * 0);

    // Initialise exponent of result as x.e + y.e.
    y.e = i + j;

    // If array xc has fewer digits than yc, swap xc and yc, and lengths.
    if (a < b) {
      c = xc;
      xc = yc;
      yc = c;
      j = a;
      a = b;
      b = j;
    }

    // Initialise coefficient array of result with zeros.
    for (c = new Array(j = a + b); j--;) c[j] = 0;

    // Multiply.

    // i is initially xc.length.
    for (i = b; i--;) {
      b = 0;

      // a is yc.length.
      for (j = a + i; j > i;) {

        // Current sum of products at this digit position, plus carry.
        b = c[j] + yc[i] * xc[j - i - 1] + b;
        c[j--] = b % 10;

        // carry
        b = b / 10 | 0;
      }

      c[j] = (c[j] + b) % 10;
    }

    // Increment result exponent if there is a final carry, otherwise remove leading zero.
    if (b) ++y.e;
    else c.shift();

    // Remove trailing zeros.
    for (i = c.length; !c[--i];) c.pop();
    y.c = c;

    return y;
  };


  /*
   * Return a string representing the value of this Big in exponential notation to dp fixed decimal
   * places and rounded using Big.RM.
   *
   * dp? {number} Integer, 0 to MAX_DP inclusive.
   */
  P.toExponential = function (dp) {
    return stringify(this, 1, dp, dp);
  };


  /*
   * Return a string representing the value of this Big in normal notation to dp fixed decimal
   * places and rounded using Big.RM.
   *
   * dp? {number} Integer, 0 to MAX_DP inclusive.
   *
   * (-0).toFixed(0) is '0', but (-0.1).toFixed(0) is '-0'.
   * (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
   */
  P.toFixed = function (dp) {
    return stringify(this, 2, dp, this.e + dp);
  };


  /*
   * Return a string representing the value of this Big rounded to sd significant digits using
   * Big.RM. Use exponential notation if sd is less than the number of digits necessary to represent
   * the integer part of the value in normal notation.
   *
   * sd {number} Integer, 1 to MAX_DP inclusive.
   */
  P.toPrecision = function (sd) {
    return stringify(this, 3, sd, sd - 1);
  };


  /*
   * Return a string representing the value of this Big.
   * Return exponential notation if this Big has a positive exponent equal to or greater than
   * Big.PE, or a negative exponent equal to or less than Big.NE.
   * Omit the sign for negative zero.
   */
  P.toString = function () {
    return stringify(this);
  };


  /*
   * Return a string representing the value of this Big.
   * Return exponential notation if this Big has a positive exponent equal to or greater than
   * Big.PE, or a negative exponent equal to or less than Big.NE.
   * Include the sign for negative zero.
   */
  P.valueOf = P.toJSON = function () {
    return stringify(this, 4);
  };


  // Export


  Big = _Big_();

  Big['default'] = Big.Big = Big;

  //AMD.
  if (typeof define === 'function' && define.amd) {
    define(function () { return Big; });

  // Node and other CommonJS-like environments that support module.exports.
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = Big;

  //Browser.
  } else {
    GLOBAL.Big = Big;
  }
})(this);

},{}],50:[function(require,module,exports){
//! moment-timezone.js
//! version : 0.5.26
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.26",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {

		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);

	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	loadData({
		"version": "2019b",
		"zones": [
			"Africa/Abidjan|GMT|0|0||48e5",
			"Africa/Nairobi|EAT|-30|0||47e5",
			"Africa/Algiers|CET|-10|0||26e5",
			"Africa/Lagos|WAT|-10|0||17e6",
			"Africa/Maputo|CAT|-20|0||26e5",
			"Africa/Cairo|EET EEST|-20 -30|01010|1M2m0 gL0 e10 mn0|15e6",
			"Africa/Casablanca|+00 +01|0 -10|010101010101010101010101010101010101|1H3C0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0|32e5",
			"Europe/Paris|CET CEST|-10 -20|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|11e6",
			"Africa/Johannesburg|SAST|-20|0||84e5",
			"Africa/Khartoum|EAT CAT|-30 -20|01|1Usl0|51e5",
			"Africa/Sao_Tome|GMT WAT|0 -10|010|1UQN0 2q00",
			"Africa/Tripoli|EET CET CEST|-20 -10 -20|0120|1IlA0 TA0 1o00|11e5",
			"Africa/Windhoek|CAT WAT|-20 -10|0101010101010|1GQo0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
			"America/Adak|HST HDT|a0 90|01010101010101010101010|1GIc0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|326",
			"America/Anchorage|AKST AKDT|90 80|01010101010101010101010|1GIb0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|30e4",
			"America/Santo_Domingo|AST|40|0||29e5",
			"America/Araguaina|-03 -02|30 20|010|1IdD0 Lz0|14e4",
			"America/Fortaleza|-03|30|0||34e5",
			"America/Asuncion|-03 -04|30 40|01010101010101010101010|1GTf0 1cN0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0|28e5",
			"America/Panama|EST|50|0||15e5",
			"America/Mexico_City|CST CDT|60 50|01010101010101010101010|1GQw0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0|20e6",
			"America/Bahia|-02 -03|20 30|01|1GCq0|27e5",
			"America/Managua|CST|60|0||22e5",
			"America/La_Paz|-04|40|0||19e5",
			"America/Lima|-05|50|0||11e6",
			"America/Denver|MST MDT|70 60|01010101010101010101010|1GI90 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|26e5",
			"America/Campo_Grande|-03 -04|30 40|0101010101010101|1GCr0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0|77e4",
			"America/Cancun|CST CDT EST|60 50 50|01010102|1GQw0 1nX0 14p0 1lb0 14p0 1lb0 Dd0|63e4",
			"America/Caracas|-0430 -04|4u 40|01|1QMT0|29e5",
			"America/Chicago|CST CDT|60 50|01010101010101010101010|1GI80 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|92e5",
			"America/Chihuahua|MST MDT|70 60|01010101010101010101010|1GQx0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0|81e4",
			"America/Phoenix|MST|70|0||42e5",
			"America/Los_Angeles|PST PDT|80 70|01010101010101010101010|1GIa0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|15e6",
			"America/New_York|EST EDT|50 40|01010101010101010101010|1GI70 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|21e6",
			"America/Rio_Branco|-04 -05|40 50|01|1KLE0|31e4",
			"America/Fort_Nelson|PST PDT MST|80 70 70|01010102|1GIa0 1zb0 Op0 1zb0 Op0 1zb0 Op0|39e2",
			"America/Halifax|AST ADT|40 30|01010101010101010101010|1GI60 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|39e4",
			"America/Godthab|-03 -02|30 20|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|17e3",
			"America/Grand_Turk|EST EDT AST|50 40 40|0101010121010101010|1GI70 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|37e2",
			"America/Havana|CST CDT|50 40|01010101010101010101010|1GQt0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0|21e5",
			"America/Metlakatla|PST AKST AKDT|80 90 80|01212120121212121|1PAa0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|14e2",
			"America/Miquelon|-03 -02|30 20|01010101010101010101010|1GI50 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|61e2",
			"America/Montevideo|-02 -03|20 30|01010101|1GI40 1o10 11z0 1o10 11z0 1o10 11z0|17e5",
			"America/Noronha|-02|20|0||30e2",
			"America/Port-au-Prince|EST EDT|50 40|010101010101010101010|1GI70 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|23e5",
			"Antarctica/Palmer|-03 -04|30 40|010101010|1H3D0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0|40",
			"America/Santiago|-03 -04|30 40|010101010101010101010|1H3D0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|62e5",
			"America/Sao_Paulo|-02 -03|20 30|0101010101010101|1GCq0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0|20e6",
			"Atlantic/Azores|-01 +00|10 0|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|25e4",
			"America/St_Johns|NST NDT|3u 2u|01010101010101010101010|1GI5u 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0|11e4",
			"Antarctica/Casey|+11 +08|-b0 -80|0101|1GAF0 blz0 3m10|10",
			"Antarctica/Davis|+05 +07|-50 -70|01|1GAI0|70",
			"Pacific/Port_Moresby|+10|-a0|0||25e4",
			"Pacific/Guadalcanal|+11|-b0|0||11e4",
			"Asia/Tashkent|+05|-50|0||23e5",
			"Pacific/Auckland|NZDT NZST|-d0 -c0|01010101010101010101010|1GQe0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00|14e5",
			"Asia/Baghdad|+03|-30|0||66e5",
			"Antarctica/Troll|+00 +02|0 -20|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|40",
			"Asia/Dhaka|+06|-60|0||16e6",
			"Asia/Amman|EET EEST|-20 -30|010101010101010101010|1GPy0 4bX0 Dd0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00|25e5",
			"Asia/Kamchatka|+12|-c0|0||18e4",
			"Asia/Baku|+04 +05|-40 -50|010101010|1GNA0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|27e5",
			"Asia/Bangkok|+07|-70|0||15e6",
			"Asia/Barnaul|+07 +06|-70 -60|010|1N7v0 3rd0",
			"Asia/Beirut|EET EEST|-20 -30|01010101010101010101010|1GNy0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0|22e5",
			"Asia/Kuala_Lumpur|+08|-80|0||71e5",
			"Asia/Kolkata|IST|-5u|0||15e6",
			"Asia/Chita|+10 +08 +09|-a0 -80 -90|012|1N7s0 3re0|33e4",
			"Asia/Ulaanbaatar|+08 +09|-80 -90|01010|1O8G0 1cJ0 1cP0 1cJ0|12e5",
			"Asia/Shanghai|CST|-80|0||23e6",
			"Asia/Colombo|+0530|-5u|0||22e5",
			"Asia/Damascus|EET EEST|-20 -30|01010101010101010101010|1GPy0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0|26e5",
			"Asia/Dili|+09|-90|0||19e4",
			"Asia/Dubai|+04|-40|0||39e5",
			"Asia/Famagusta|EET EEST +03|-20 -30 -30|0101010101201010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0",
			"Asia/Gaza|EET EEST|-20 -30|01010101010101010101010|1GPy0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11c0 1oo0 11c0 1rc0 Wo0 1rc0 Wo0 1rc0|18e5",
			"Asia/Hong_Kong|HKT|-80|0||73e5",
			"Asia/Hovd|+07 +08|-70 -80|01010|1O8H0 1cJ0 1cP0 1cJ0|81e3",
			"Asia/Irkutsk|+09 +08|-90 -80|01|1N7t0|60e4",
			"Europe/Istanbul|EET EEST +03|-20 -30 -30|01010101012|1GNB0 1qM0 11A0 1o00 1200 1nA0 11A0 1tA0 U00 15w0|13e6",
			"Asia/Jakarta|WIB|-70|0||31e6",
			"Asia/Jayapura|WIT|-90|0||26e4",
			"Asia/Jerusalem|IST IDT|-20 -30|01010101010101010101010|1GPA0 1aL0 1eN0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0|81e4",
			"Asia/Kabul|+0430|-4u|0||46e5",
			"Asia/Karachi|PKT|-50|0||24e6",
			"Asia/Kathmandu|+0545|-5J|0||12e5",
			"Asia/Yakutsk|+10 +09|-a0 -90|01|1N7s0|28e4",
			"Asia/Krasnoyarsk|+08 +07|-80 -70|01|1N7u0|10e5",
			"Asia/Magadan|+12 +10 +11|-c0 -a0 -b0|012|1N7q0 3Cq0|95e3",
			"Asia/Makassar|WITA|-80|0||15e5",
			"Asia/Manila|PST|-80|0||24e6",
			"Europe/Athens|EET EEST|-20 -30|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|35e5",
			"Asia/Novosibirsk|+07 +06|-70 -60|010|1N7v0 4eN0|15e5",
			"Asia/Omsk|+07 +06|-70 -60|01|1N7v0|12e5",
			"Asia/Pyongyang|KST KST|-90 -8u|010|1P4D0 6BA0|29e5",
			"Asia/Qyzylorda|+06 +05|-60 -50|01|1Xei0|73e4",
			"Asia/Rangoon|+0630|-6u|0||48e5",
			"Asia/Sakhalin|+11 +10|-b0 -a0|010|1N7r0 3rd0|58e4",
			"Asia/Seoul|KST|-90|0||23e6",
			"Asia/Srednekolymsk|+12 +11|-c0 -b0|01|1N7q0|35e2",
			"Asia/Tehran|+0330 +0430|-3u -4u|01010101010101010101010|1GLUu 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0|14e6",
			"Asia/Tokyo|JST|-90|0||38e6",
			"Asia/Tomsk|+07 +06|-70 -60|010|1N7v0 3Qp0|10e5",
			"Asia/Vladivostok|+11 +10|-b0 -a0|01|1N7r0|60e4",
			"Asia/Yekaterinburg|+06 +05|-60 -50|01|1N7w0|14e5",
			"Europe/Lisbon|WET WEST|0 -10|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|27e5",
			"Atlantic/Cape_Verde|-01|10|0||50e4",
			"Australia/Sydney|AEDT AEST|-b0 -a0|01010101010101010101010|1GQg0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0|40e5",
			"Australia/Adelaide|ACDT ACST|-au -9u|01010101010101010101010|1GQgu 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0|11e5",
			"Australia/Brisbane|AEST|-a0|0||20e5",
			"Australia/Darwin|ACST|-9u|0||12e4",
			"Australia/Eucla|+0845|-8J|0||368",
			"Australia/Lord_Howe|+11 +1030|-b0 -au|01010101010101010101010|1GQf0 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu|347",
			"Australia/Perth|AWST|-80|0||18e5",
			"Pacific/Easter|-05 -06|50 60|010101010101010101010|1H3D0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|30e2",
			"Europe/Dublin|GMT IST|0 -10|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|12e5",
			"Etc/GMT-1|+01|-10|0|",
			"Pacific/Fakaofo|+13|-d0|0||483",
			"Pacific/Kiritimati|+14|-e0|0||51e2",
			"Etc/GMT-2|+02|-20|0|",
			"Pacific/Tahiti|-10|a0|0||18e4",
			"Pacific/Niue|-11|b0|0||12e2",
			"Etc/GMT+12|-12|c0|0|",
			"Pacific/Galapagos|-06|60|0||25e3",
			"Etc/GMT+7|-07|70|0|",
			"Pacific/Pitcairn|-08|80|0||56",
			"Pacific/Gambier|-09|90|0||125",
			"Etc/UTC|UTC|0|0|",
			"Europe/Ulyanovsk|+04 +03|-40 -30|010|1N7y0 3rd0|13e5",
			"Europe/London|GMT BST|0 -10|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|10e6",
			"Europe/Chisinau|EET EEST|-20 -30|01010101010101010101010|1GNA0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|67e4",
			"Europe/Kaliningrad|+03 EET|-30 -20|01|1N7z0|44e4",
			"Europe/Kirov|+04 +03|-40 -30|01|1N7y0|48e4",
			"Europe/Moscow|MSK MSK|-40 -30|01|1N7y0|16e6",
			"Europe/Saratov|+04 +03|-40 -30|010|1N7y0 5810",
			"Europe/Simferopol|EET EEST MSK MSK|-20 -30 -40 -30|0101023|1GNB0 1qM0 11A0 1o00 11z0 1nW0|33e4",
			"Europe/Volgograd|+04 +03|-40 -30|010|1N7y0 9Jd0|10e5",
			"Pacific/Honolulu|HST|a0|0||37e4",
			"MET|MET MEST|-10 -20|01010101010101010101010|1GNB0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0",
			"Pacific/Chatham|+1345 +1245|-dJ -cJ|01010101010101010101010|1GQe0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00|600",
			"Pacific/Apia|+14 +13|-e0 -d0|01010101010101010101010|1GQe0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00|37e3",
			"Pacific/Bougainville|+10 +11|-a0 -b0|01|1NwE0|18e4",
			"Pacific/Fiji|+13 +12|-d0 -c0|01010101010101010101010|1Goe0 1Nc0 Ao0 1Q00 xz0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0|88e4",
			"Pacific/Guam|ChST|-a0|0||17e4",
			"Pacific/Marquesas|-0930|9u|0||86e2",
			"Pacific/Pago_Pago|SST|b0|0||37e2",
			"Pacific/Norfolk|+1130 +11|-bu -b0|01|1PoCu|25e4",
			"Pacific/Tongatapu|+13 +14|-d0 -e0|010|1S4d0 s00|75e3"
		],
		"links": [
			"Africa/Abidjan|Africa/Accra",
			"Africa/Abidjan|Africa/Bamako",
			"Africa/Abidjan|Africa/Banjul",
			"Africa/Abidjan|Africa/Bissau",
			"Africa/Abidjan|Africa/Conakry",
			"Africa/Abidjan|Africa/Dakar",
			"Africa/Abidjan|Africa/Freetown",
			"Africa/Abidjan|Africa/Lome",
			"Africa/Abidjan|Africa/Monrovia",
			"Africa/Abidjan|Africa/Nouakchott",
			"Africa/Abidjan|Africa/Ouagadougou",
			"Africa/Abidjan|Africa/Timbuktu",
			"Africa/Abidjan|America/Danmarkshavn",
			"Africa/Abidjan|Atlantic/Reykjavik",
			"Africa/Abidjan|Atlantic/St_Helena",
			"Africa/Abidjan|Etc/GMT",
			"Africa/Abidjan|Etc/GMT+0",
			"Africa/Abidjan|Etc/GMT-0",
			"Africa/Abidjan|Etc/GMT0",
			"Africa/Abidjan|Etc/Greenwich",
			"Africa/Abidjan|GMT",
			"Africa/Abidjan|GMT+0",
			"Africa/Abidjan|GMT-0",
			"Africa/Abidjan|GMT0",
			"Africa/Abidjan|Greenwich",
			"Africa/Abidjan|Iceland",
			"Africa/Algiers|Africa/Tunis",
			"Africa/Cairo|Egypt",
			"Africa/Casablanca|Africa/El_Aaiun",
			"Africa/Johannesburg|Africa/Maseru",
			"Africa/Johannesburg|Africa/Mbabane",
			"Africa/Lagos|Africa/Bangui",
			"Africa/Lagos|Africa/Brazzaville",
			"Africa/Lagos|Africa/Douala",
			"Africa/Lagos|Africa/Kinshasa",
			"Africa/Lagos|Africa/Libreville",
			"Africa/Lagos|Africa/Luanda",
			"Africa/Lagos|Africa/Malabo",
			"Africa/Lagos|Africa/Ndjamena",
			"Africa/Lagos|Africa/Niamey",
			"Africa/Lagos|Africa/Porto-Novo",
			"Africa/Maputo|Africa/Blantyre",
			"Africa/Maputo|Africa/Bujumbura",
			"Africa/Maputo|Africa/Gaborone",
			"Africa/Maputo|Africa/Harare",
			"Africa/Maputo|Africa/Kigali",
			"Africa/Maputo|Africa/Lubumbashi",
			"Africa/Maputo|Africa/Lusaka",
			"Africa/Nairobi|Africa/Addis_Ababa",
			"Africa/Nairobi|Africa/Asmara",
			"Africa/Nairobi|Africa/Asmera",
			"Africa/Nairobi|Africa/Dar_es_Salaam",
			"Africa/Nairobi|Africa/Djibouti",
			"Africa/Nairobi|Africa/Juba",
			"Africa/Nairobi|Africa/Kampala",
			"Africa/Nairobi|Africa/Mogadishu",
			"Africa/Nairobi|Indian/Antananarivo",
			"Africa/Nairobi|Indian/Comoro",
			"Africa/Nairobi|Indian/Mayotte",
			"Africa/Tripoli|Libya",
			"America/Adak|America/Atka",
			"America/Adak|US/Aleutian",
			"America/Anchorage|America/Juneau",
			"America/Anchorage|America/Nome",
			"America/Anchorage|America/Sitka",
			"America/Anchorage|America/Yakutat",
			"America/Anchorage|US/Alaska",
			"America/Campo_Grande|America/Cuiaba",
			"America/Chicago|America/Indiana/Knox",
			"America/Chicago|America/Indiana/Tell_City",
			"America/Chicago|America/Knox_IN",
			"America/Chicago|America/Matamoros",
			"America/Chicago|America/Menominee",
			"America/Chicago|America/North_Dakota/Beulah",
			"America/Chicago|America/North_Dakota/Center",
			"America/Chicago|America/North_Dakota/New_Salem",
			"America/Chicago|America/Rainy_River",
			"America/Chicago|America/Rankin_Inlet",
			"America/Chicago|America/Resolute",
			"America/Chicago|America/Winnipeg",
			"America/Chicago|CST6CDT",
			"America/Chicago|Canada/Central",
			"America/Chicago|US/Central",
			"America/Chicago|US/Indiana-Starke",
			"America/Chihuahua|America/Mazatlan",
			"America/Chihuahua|Mexico/BajaSur",
			"America/Denver|America/Boise",
			"America/Denver|America/Cambridge_Bay",
			"America/Denver|America/Edmonton",
			"America/Denver|America/Inuvik",
			"America/Denver|America/Ojinaga",
			"America/Denver|America/Shiprock",
			"America/Denver|America/Yellowknife",
			"America/Denver|Canada/Mountain",
			"America/Denver|MST7MDT",
			"America/Denver|Navajo",
			"America/Denver|US/Mountain",
			"America/Fortaleza|America/Argentina/Buenos_Aires",
			"America/Fortaleza|America/Argentina/Catamarca",
			"America/Fortaleza|America/Argentina/ComodRivadavia",
			"America/Fortaleza|America/Argentina/Cordoba",
			"America/Fortaleza|America/Argentina/Jujuy",
			"America/Fortaleza|America/Argentina/La_Rioja",
			"America/Fortaleza|America/Argentina/Mendoza",
			"America/Fortaleza|America/Argentina/Rio_Gallegos",
			"America/Fortaleza|America/Argentina/Salta",
			"America/Fortaleza|America/Argentina/San_Juan",
			"America/Fortaleza|America/Argentina/San_Luis",
			"America/Fortaleza|America/Argentina/Tucuman",
			"America/Fortaleza|America/Argentina/Ushuaia",
			"America/Fortaleza|America/Belem",
			"America/Fortaleza|America/Buenos_Aires",
			"America/Fortaleza|America/Catamarca",
			"America/Fortaleza|America/Cayenne",
			"America/Fortaleza|America/Cordoba",
			"America/Fortaleza|America/Jujuy",
			"America/Fortaleza|America/Maceio",
			"America/Fortaleza|America/Mendoza",
			"America/Fortaleza|America/Paramaribo",
			"America/Fortaleza|America/Recife",
			"America/Fortaleza|America/Rosario",
			"America/Fortaleza|America/Santarem",
			"America/Fortaleza|Antarctica/Rothera",
			"America/Fortaleza|Atlantic/Stanley",
			"America/Fortaleza|Etc/GMT+3",
			"America/Halifax|America/Glace_Bay",
			"America/Halifax|America/Goose_Bay",
			"America/Halifax|America/Moncton",
			"America/Halifax|America/Thule",
			"America/Halifax|Atlantic/Bermuda",
			"America/Halifax|Canada/Atlantic",
			"America/Havana|Cuba",
			"America/La_Paz|America/Boa_Vista",
			"America/La_Paz|America/Guyana",
			"America/La_Paz|America/Manaus",
			"America/La_Paz|America/Porto_Velho",
			"America/La_Paz|Brazil/West",
			"America/La_Paz|Etc/GMT+4",
			"America/Lima|America/Bogota",
			"America/Lima|America/Guayaquil",
			"America/Lima|Etc/GMT+5",
			"America/Los_Angeles|America/Dawson",
			"America/Los_Angeles|America/Ensenada",
			"America/Los_Angeles|America/Santa_Isabel",
			"America/Los_Angeles|America/Tijuana",
			"America/Los_Angeles|America/Vancouver",
			"America/Los_Angeles|America/Whitehorse",
			"America/Los_Angeles|Canada/Pacific",
			"America/Los_Angeles|Canada/Yukon",
			"America/Los_Angeles|Mexico/BajaNorte",
			"America/Los_Angeles|PST8PDT",
			"America/Los_Angeles|US/Pacific",
			"America/Los_Angeles|US/Pacific-New",
			"America/Managua|America/Belize",
			"America/Managua|America/Costa_Rica",
			"America/Managua|America/El_Salvador",
			"America/Managua|America/Guatemala",
			"America/Managua|America/Regina",
			"America/Managua|America/Swift_Current",
			"America/Managua|America/Tegucigalpa",
			"America/Managua|Canada/Saskatchewan",
			"America/Mexico_City|America/Bahia_Banderas",
			"America/Mexico_City|America/Merida",
			"America/Mexico_City|America/Monterrey",
			"America/Mexico_City|Mexico/General",
			"America/New_York|America/Detroit",
			"America/New_York|America/Fort_Wayne",
			"America/New_York|America/Indiana/Indianapolis",
			"America/New_York|America/Indiana/Marengo",
			"America/New_York|America/Indiana/Petersburg",
			"America/New_York|America/Indiana/Vevay",
			"America/New_York|America/Indiana/Vincennes",
			"America/New_York|America/Indiana/Winamac",
			"America/New_York|America/Indianapolis",
			"America/New_York|America/Iqaluit",
			"America/New_York|America/Kentucky/Louisville",
			"America/New_York|America/Kentucky/Monticello",
			"America/New_York|America/Louisville",
			"America/New_York|America/Montreal",
			"America/New_York|America/Nassau",
			"America/New_York|America/Nipigon",
			"America/New_York|America/Pangnirtung",
			"America/New_York|America/Thunder_Bay",
			"America/New_York|America/Toronto",
			"America/New_York|Canada/Eastern",
			"America/New_York|EST5EDT",
			"America/New_York|US/East-Indiana",
			"America/New_York|US/Eastern",
			"America/New_York|US/Michigan",
			"America/Noronha|Atlantic/South_Georgia",
			"America/Noronha|Brazil/DeNoronha",
			"America/Noronha|Etc/GMT+2",
			"America/Panama|America/Atikokan",
			"America/Panama|America/Cayman",
			"America/Panama|America/Coral_Harbour",
			"America/Panama|America/Jamaica",
			"America/Panama|EST",
			"America/Panama|Jamaica",
			"America/Phoenix|America/Creston",
			"America/Phoenix|America/Dawson_Creek",
			"America/Phoenix|America/Hermosillo",
			"America/Phoenix|MST",
			"America/Phoenix|US/Arizona",
			"America/Rio_Branco|America/Eirunepe",
			"America/Rio_Branco|America/Porto_Acre",
			"America/Rio_Branco|Brazil/Acre",
			"America/Santiago|Chile/Continental",
			"America/Santo_Domingo|America/Anguilla",
			"America/Santo_Domingo|America/Antigua",
			"America/Santo_Domingo|America/Aruba",
			"America/Santo_Domingo|America/Barbados",
			"America/Santo_Domingo|America/Blanc-Sablon",
			"America/Santo_Domingo|America/Curacao",
			"America/Santo_Domingo|America/Dominica",
			"America/Santo_Domingo|America/Grenada",
			"America/Santo_Domingo|America/Guadeloupe",
			"America/Santo_Domingo|America/Kralendijk",
			"America/Santo_Domingo|America/Lower_Princes",
			"America/Santo_Domingo|America/Marigot",
			"America/Santo_Domingo|America/Martinique",
			"America/Santo_Domingo|America/Montserrat",
			"America/Santo_Domingo|America/Port_of_Spain",
			"America/Santo_Domingo|America/Puerto_Rico",
			"America/Santo_Domingo|America/St_Barthelemy",
			"America/Santo_Domingo|America/St_Kitts",
			"America/Santo_Domingo|America/St_Lucia",
			"America/Santo_Domingo|America/St_Thomas",
			"America/Santo_Domingo|America/St_Vincent",
			"America/Santo_Domingo|America/Tortola",
			"America/Santo_Domingo|America/Virgin",
			"America/Sao_Paulo|Brazil/East",
			"America/St_Johns|Canada/Newfoundland",
			"Antarctica/Palmer|America/Punta_Arenas",
			"Asia/Baghdad|Antarctica/Syowa",
			"Asia/Baghdad|Asia/Aden",
			"Asia/Baghdad|Asia/Bahrain",
			"Asia/Baghdad|Asia/Kuwait",
			"Asia/Baghdad|Asia/Qatar",
			"Asia/Baghdad|Asia/Riyadh",
			"Asia/Baghdad|Etc/GMT-3",
			"Asia/Baghdad|Europe/Minsk",
			"Asia/Bangkok|Asia/Ho_Chi_Minh",
			"Asia/Bangkok|Asia/Novokuznetsk",
			"Asia/Bangkok|Asia/Phnom_Penh",
			"Asia/Bangkok|Asia/Saigon",
			"Asia/Bangkok|Asia/Vientiane",
			"Asia/Bangkok|Etc/GMT-7",
			"Asia/Bangkok|Indian/Christmas",
			"Asia/Dhaka|Antarctica/Vostok",
			"Asia/Dhaka|Asia/Almaty",
			"Asia/Dhaka|Asia/Bishkek",
			"Asia/Dhaka|Asia/Dacca",
			"Asia/Dhaka|Asia/Kashgar",
			"Asia/Dhaka|Asia/Qostanay",
			"Asia/Dhaka|Asia/Thimbu",
			"Asia/Dhaka|Asia/Thimphu",
			"Asia/Dhaka|Asia/Urumqi",
			"Asia/Dhaka|Etc/GMT-6",
			"Asia/Dhaka|Indian/Chagos",
			"Asia/Dili|Etc/GMT-9",
			"Asia/Dili|Pacific/Palau",
			"Asia/Dubai|Asia/Muscat",
			"Asia/Dubai|Asia/Tbilisi",
			"Asia/Dubai|Asia/Yerevan",
			"Asia/Dubai|Etc/GMT-4",
			"Asia/Dubai|Europe/Samara",
			"Asia/Dubai|Indian/Mahe",
			"Asia/Dubai|Indian/Mauritius",
			"Asia/Dubai|Indian/Reunion",
			"Asia/Gaza|Asia/Hebron",
			"Asia/Hong_Kong|Hongkong",
			"Asia/Jakarta|Asia/Pontianak",
			"Asia/Jerusalem|Asia/Tel_Aviv",
			"Asia/Jerusalem|Israel",
			"Asia/Kamchatka|Asia/Anadyr",
			"Asia/Kamchatka|Etc/GMT-12",
			"Asia/Kamchatka|Kwajalein",
			"Asia/Kamchatka|Pacific/Funafuti",
			"Asia/Kamchatka|Pacific/Kwajalein",
			"Asia/Kamchatka|Pacific/Majuro",
			"Asia/Kamchatka|Pacific/Nauru",
			"Asia/Kamchatka|Pacific/Tarawa",
			"Asia/Kamchatka|Pacific/Wake",
			"Asia/Kamchatka|Pacific/Wallis",
			"Asia/Kathmandu|Asia/Katmandu",
			"Asia/Kolkata|Asia/Calcutta",
			"Asia/Kuala_Lumpur|Asia/Brunei",
			"Asia/Kuala_Lumpur|Asia/Kuching",
			"Asia/Kuala_Lumpur|Asia/Singapore",
			"Asia/Kuala_Lumpur|Etc/GMT-8",
			"Asia/Kuala_Lumpur|Singapore",
			"Asia/Makassar|Asia/Ujung_Pandang",
			"Asia/Rangoon|Asia/Yangon",
			"Asia/Rangoon|Indian/Cocos",
			"Asia/Seoul|ROK",
			"Asia/Shanghai|Asia/Chongqing",
			"Asia/Shanghai|Asia/Chungking",
			"Asia/Shanghai|Asia/Harbin",
			"Asia/Shanghai|Asia/Macao",
			"Asia/Shanghai|Asia/Macau",
			"Asia/Shanghai|Asia/Taipei",
			"Asia/Shanghai|PRC",
			"Asia/Shanghai|ROC",
			"Asia/Tashkent|Antarctica/Mawson",
			"Asia/Tashkent|Asia/Aqtau",
			"Asia/Tashkent|Asia/Aqtobe",
			"Asia/Tashkent|Asia/Ashgabat",
			"Asia/Tashkent|Asia/Ashkhabad",
			"Asia/Tashkent|Asia/Atyrau",
			"Asia/Tashkent|Asia/Dushanbe",
			"Asia/Tashkent|Asia/Oral",
			"Asia/Tashkent|Asia/Samarkand",
			"Asia/Tashkent|Etc/GMT-5",
			"Asia/Tashkent|Indian/Kerguelen",
			"Asia/Tashkent|Indian/Maldives",
			"Asia/Tehran|Iran",
			"Asia/Tokyo|Japan",
			"Asia/Ulaanbaatar|Asia/Choibalsan",
			"Asia/Ulaanbaatar|Asia/Ulan_Bator",
			"Asia/Vladivostok|Asia/Ust-Nera",
			"Asia/Yakutsk|Asia/Khandyga",
			"Atlantic/Azores|America/Scoresbysund",
			"Atlantic/Cape_Verde|Etc/GMT+1",
			"Australia/Adelaide|Australia/Broken_Hill",
			"Australia/Adelaide|Australia/South",
			"Australia/Adelaide|Australia/Yancowinna",
			"Australia/Brisbane|Australia/Lindeman",
			"Australia/Brisbane|Australia/Queensland",
			"Australia/Darwin|Australia/North",
			"Australia/Lord_Howe|Australia/LHI",
			"Australia/Perth|Australia/West",
			"Australia/Sydney|Australia/ACT",
			"Australia/Sydney|Australia/Canberra",
			"Australia/Sydney|Australia/Currie",
			"Australia/Sydney|Australia/Hobart",
			"Australia/Sydney|Australia/Melbourne",
			"Australia/Sydney|Australia/NSW",
			"Australia/Sydney|Australia/Tasmania",
			"Australia/Sydney|Australia/Victoria",
			"Etc/UTC|Etc/UCT",
			"Etc/UTC|Etc/Universal",
			"Etc/UTC|Etc/Zulu",
			"Etc/UTC|UCT",
			"Etc/UTC|UTC",
			"Etc/UTC|Universal",
			"Etc/UTC|Zulu",
			"Europe/Athens|Asia/Nicosia",
			"Europe/Athens|EET",
			"Europe/Athens|Europe/Bucharest",
			"Europe/Athens|Europe/Helsinki",
			"Europe/Athens|Europe/Kiev",
			"Europe/Athens|Europe/Mariehamn",
			"Europe/Athens|Europe/Nicosia",
			"Europe/Athens|Europe/Riga",
			"Europe/Athens|Europe/Sofia",
			"Europe/Athens|Europe/Tallinn",
			"Europe/Athens|Europe/Uzhgorod",
			"Europe/Athens|Europe/Vilnius",
			"Europe/Athens|Europe/Zaporozhye",
			"Europe/Chisinau|Europe/Tiraspol",
			"Europe/Dublin|Eire",
			"Europe/Istanbul|Asia/Istanbul",
			"Europe/Istanbul|Turkey",
			"Europe/Lisbon|Atlantic/Canary",
			"Europe/Lisbon|Atlantic/Faeroe",
			"Europe/Lisbon|Atlantic/Faroe",
			"Europe/Lisbon|Atlantic/Madeira",
			"Europe/Lisbon|Portugal",
			"Europe/Lisbon|WET",
			"Europe/London|Europe/Belfast",
			"Europe/London|Europe/Guernsey",
			"Europe/London|Europe/Isle_of_Man",
			"Europe/London|Europe/Jersey",
			"Europe/London|GB",
			"Europe/London|GB-Eire",
			"Europe/Moscow|W-SU",
			"Europe/Paris|Africa/Ceuta",
			"Europe/Paris|Arctic/Longyearbyen",
			"Europe/Paris|Atlantic/Jan_Mayen",
			"Europe/Paris|CET",
			"Europe/Paris|Europe/Amsterdam",
			"Europe/Paris|Europe/Andorra",
			"Europe/Paris|Europe/Belgrade",
			"Europe/Paris|Europe/Berlin",
			"Europe/Paris|Europe/Bratislava",
			"Europe/Paris|Europe/Brussels",
			"Europe/Paris|Europe/Budapest",
			"Europe/Paris|Europe/Busingen",
			"Europe/Paris|Europe/Copenhagen",
			"Europe/Paris|Europe/Gibraltar",
			"Europe/Paris|Europe/Ljubljana",
			"Europe/Paris|Europe/Luxembourg",
			"Europe/Paris|Europe/Madrid",
			"Europe/Paris|Europe/Malta",
			"Europe/Paris|Europe/Monaco",
			"Europe/Paris|Europe/Oslo",
			"Europe/Paris|Europe/Podgorica",
			"Europe/Paris|Europe/Prague",
			"Europe/Paris|Europe/Rome",
			"Europe/Paris|Europe/San_Marino",
			"Europe/Paris|Europe/Sarajevo",
			"Europe/Paris|Europe/Skopje",
			"Europe/Paris|Europe/Stockholm",
			"Europe/Paris|Europe/Tirane",
			"Europe/Paris|Europe/Vaduz",
			"Europe/Paris|Europe/Vatican",
			"Europe/Paris|Europe/Vienna",
			"Europe/Paris|Europe/Warsaw",
			"Europe/Paris|Europe/Zagreb",
			"Europe/Paris|Europe/Zurich",
			"Europe/Paris|Poland",
			"Europe/Ulyanovsk|Europe/Astrakhan",
			"Pacific/Auckland|Antarctica/McMurdo",
			"Pacific/Auckland|Antarctica/South_Pole",
			"Pacific/Auckland|NZ",
			"Pacific/Chatham|NZ-CHAT",
			"Pacific/Easter|Chile/EasterIsland",
			"Pacific/Fakaofo|Etc/GMT-13",
			"Pacific/Fakaofo|Pacific/Enderbury",
			"Pacific/Galapagos|Etc/GMT+6",
			"Pacific/Gambier|Etc/GMT+9",
			"Pacific/Guadalcanal|Antarctica/Macquarie",
			"Pacific/Guadalcanal|Etc/GMT-11",
			"Pacific/Guadalcanal|Pacific/Efate",
			"Pacific/Guadalcanal|Pacific/Kosrae",
			"Pacific/Guadalcanal|Pacific/Noumea",
			"Pacific/Guadalcanal|Pacific/Pohnpei",
			"Pacific/Guadalcanal|Pacific/Ponape",
			"Pacific/Guam|Pacific/Saipan",
			"Pacific/Honolulu|HST",
			"Pacific/Honolulu|Pacific/Johnston",
			"Pacific/Honolulu|US/Hawaii",
			"Pacific/Kiritimati|Etc/GMT-14",
			"Pacific/Niue|Etc/GMT+11",
			"Pacific/Pago_Pago|Pacific/Midway",
			"Pacific/Pago_Pago|Pacific/Samoa",
			"Pacific/Pago_Pago|US/Samoa",
			"Pacific/Pitcairn|Etc/GMT+8",
			"Pacific/Port_Moresby|Antarctica/DumontDUrville",
			"Pacific/Port_Moresby|Etc/GMT-10",
			"Pacific/Port_Moresby|Pacific/Chuuk",
			"Pacific/Port_Moresby|Pacific/Truk",
			"Pacific/Port_Moresby|Pacific/Yap",
			"Pacific/Tahiti|Etc/GMT+10",
			"Pacific/Tahiti|Pacific/Rarotonga"
		]
	});


	return moment;
}));

},{"moment":54}],51:[function(require,module,exports){
module.exports={
	"version": "2019b",
	"zones": [
		"Africa/Abidjan|LMT GMT|g.8 0|01|-2ldXH.Q|48e5",
		"Africa/Accra|LMT GMT +0020|.Q 0 -k|012121212121212121212121212121212121212121212121|-26BbX.8 6tzX.8 MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE|41e5",
		"Africa/Nairobi|LMT EAT +0230 +0245|-2r.g -30 -2u -2J|01231|-1F3Cr.g 3Dzr.g okMu MFXJ|47e5",
		"Africa/Algiers|PMT WET WEST CET CEST|-9.l 0 -10 -10 -20|0121212121212121343431312123431213|-2nco9.l cNb9.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 DA0 Imo0 rd0 De0 9Xz0 1fb0 1ap0 16K0 2yo0 mEp0 hwL0 jxA0 11A0 dDd0 17b0 11B0 1cN0 2Dy0 1cN0 1fB0 1cL0|26e5",
		"Africa/Lagos|LMT WAT|-d.A -10|01|-22y0d.A|17e6",
		"Africa/Bissau|LMT -01 GMT|12.k 10 0|012|-2ldX0 2xoo0|39e4",
		"Africa/Maputo|LMT CAT|-2a.k -20|01|-2GJea.k|26e5",
		"Africa/Cairo|EET EEST|-20 -30|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-1bIO0 vb0 1ip0 11z0 1iN0 1nz0 12p0 1pz0 10N0 1pz0 16p0 1jz0 s3d0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1WL0 rd0 1Rz0 wp0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1qL0 Xd0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1ny0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 WL0 1qN0 Rb0 1wp0 On0 1zd0 Lz0 1EN0 Fb0 c10 8n0 8Nd0 gL0 e10 mn0|15e6",
		"Africa/Casablanca|LMT +00 +01|u.k 0 -10|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-2gMnt.E 130Lt.E rb0 Dd0 dVb0 b6p0 TX0 EoB0 LL0 gnd0 rz0 43d0 AL0 1Nd0 XX0 1Cp0 pz0 dEp0 4mn0 SyN0 AL0 1Nd0 wn0 1FB0 Db0 1zd0 Lz0 1Nf0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00 2600 gM0 2600 e00 2600 gM0 2600 e00 28M0 e00 2600 gM0|32e5",
		"Africa/Ceuta|WET WEST CET CEST|0 -10 -10 -20|010101010101010101010232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-25KN0 11z0 drd0 18p0 3HX0 17d0 1fz0 1a10 1io0 1a00 1y7o0 LL0 gnd0 rz0 43d0 AL0 1Nd0 XX0 1Cp0 pz0 dEp0 4VB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|85e3",
		"Africa/El_Aaiun|LMT -01 +00 +01|Q.M 10 0 -10|012323232323232323232323232323232323232323232323232323232323232323232323232323232323|-1rDz7.c 1GVA7.c 6L0 AL0 1Nd0 XX0 1Cp0 pz0 1cBB0 AL0 1Nd0 wn0 1FB0 Db0 1zd0 Lz0 1Nf0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00 2600 e00 28M0 e00 2600 gM0 2600 e00 28M0 e00 2600 gM0 2600 e00 2600 gM0 2600 e00 28M0 e00 2600 gM0|20e4",
		"Africa/Johannesburg|SAST SAST SAST|-1u -20 -30|012121|-2GJdu 1Ajdu 1cL0 1cN0 1cL0|84e5",
		"Africa/Juba|LMT CAT CAST EAT|-26.s -20 -30 -30|01212121212121212121212121212121213|-1yW26.s 1zK06.s 16L0 1iN0 17b0 1jd0 17b0 1ip0 17z0 1i10 17X0 1hB0 18n0 1hd0 19b0 1gp0 19z0 1iN0 17b0 1ip0 17z0 1i10 18n0 1hd0 18L0 1gN0 19b0 1gp0 19z0 1iN0 17z0 1i10 17X0 yGd0",
		"Africa/Khartoum|LMT CAT CAST EAT|-2a.8 -20 -30 -30|012121212121212121212121212121212131|-1yW2a.8 1zK0a.8 16L0 1iN0 17b0 1jd0 17b0 1ip0 17z0 1i10 17X0 1hB0 18n0 1hd0 19b0 1gp0 19z0 1iN0 17b0 1ip0 17z0 1i10 18n0 1hd0 18L0 1gN0 19b0 1gp0 19z0 1iN0 17z0 1i10 17X0 yGd0 HjL0|51e5",
		"Africa/Monrovia|MMT MMT GMT|H.8 I.u 0|012|-23Lzg.Q 28G01.m|11e5",
		"Africa/Ndjamena|LMT WAT WAST|-10.c -10 -20|0121|-2le10.c 2J3c0.c Wn0|13e5",
		"Africa/Sao_Tome|LMT GMT WAT|A.J 0 -10|0121|-2le00 4i6N0 2q00",
		"Africa/Tripoli|LMT CET CEST EET|-Q.I -10 -20 -20|012121213121212121212121213123123|-21JcQ.I 1hnBQ.I vx0 4iP0 xx0 4eN0 Bb0 7ip0 U0n0 A10 1db0 1cN0 1db0 1dd0 1db0 1eN0 1bb0 1e10 1cL0 1c10 1db0 1dd0 1db0 1cN0 1db0 1q10 fAn0 1ep0 1db0 AKq0 TA0 1o00|11e5",
		"Africa/Tunis|PMT CET CEST|-9.l -10 -20|0121212121212121212121212121212121|-2nco9.l 18pa9.l 1qM0 DA0 3Tc0 11B0 1ze0 WM0 7z0 3d0 14L0 1cN0 1f90 1ar0 16J0 1gXB0 WM0 1rA0 11c0 nwo0 Ko0 1cM0 1cM0 1rA0 10M0 zuM0 10N0 1aN0 1qM0 WM0 1qM0 11A0 1o00|20e5",
		"Africa/Windhoek|+0130 SAST SAST CAT WAT|-1u -20 -30 -20 -10|01213434343434343434343434343434343434343434343434343|-2GJdu 1Ajdu 1cL0 1SqL0 9Io0 16P0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
		"America/Adak|NST NWT NPT BST BDT AHST HST HDT|b0 a0 a0 b0 a0 a0 a0 90|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17SX0 8wW0 iB0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cm0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
		"America/Anchorage|AST AWT APT AHST AHDT YST AKST AKDT|a0 90 90 a0 90 90 90 80|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17T00 8wX0 iA0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cm0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
		"America/Port_of_Spain|LMT AST|46.4 40|01|-2kNvR.U|43e3",
		"America/Araguaina|LMT -03 -02|3c.M 30 20|0121212121212121212121212121212121212121212121212121|-2glwL.c HdKL.c 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 dMN0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 ny10 Lz0|14e4",
		"America/Argentina/Buenos_Aires|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323232323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 A4p0 uL0 1qN0 WL0",
		"America/Argentina/Catamarca|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323132321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 rlB0 7B0 8zb0 uL0",
		"America/Argentina/Cordoba|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323132323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 A4p0 uL0 1qN0 WL0",
		"America/Argentina/Jujuy|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323121323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1ze0 TX0 1ld0 WK0 1wp0 TX0 A4p0 uL0",
		"America/Argentina/La_Rioja|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323231232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Qn0 qO0 16n0 Rb0 1wp0 TX0 rlB0 7B0 8zb0 uL0",
		"America/Argentina/Mendoza|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232312121321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1u20 SL0 1vd0 Tb0 1wp0 TW0 ri10 Op0 7TX0 uL0",
		"America/Argentina/Rio_Gallegos|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 rlB0 7B0 8zb0 uL0",
		"America/Argentina/Salta|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323231323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 A4p0 uL0",
		"America/Argentina/San_Juan|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323231232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Qn0 qO0 16n0 Rb0 1wp0 TX0 rld0 m10 8lb0 uL0",
		"America/Argentina/San_Luis|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323121212321212|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 XX0 1q20 SL0 AN0 vDb0 m10 8lb0 8L0 jd0 1qN0 WL0 1qN0",
		"America/Argentina/Tucuman|CMT -04 -03 -02|4g.M 40 30 20|0121212121212121212121212121212121212121212323232313232123232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 rlB0 4N0 8BX0 uL0 1qN0 WL0",
		"America/Argentina/Ushuaia|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 rkN0 8p0 8zb0 uL0",
		"America/Curacao|LMT -0430 AST|4z.L 4u 40|012|-2kV7o.d 28KLS.d|15e4",
		"America/Asuncion|AMT -04 -03|3O.E 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-1x589.k 1DKM9.k 3CL0 3Dd0 10L0 1pB0 10n0 1pB0 10n0 1pB0 1cL0 1dd0 1db0 1dd0 1cL0 1dd0 1cL0 1dd0 1cL0 1dd0 1db0 1dd0 1cL0 1dd0 1cL0 1dd0 1cL0 1dd0 1db0 1dd0 1cL0 1lB0 14n0 1dd0 1cL0 1fd0 WL0 1rd0 1aL0 1dB0 Xz0 1qp0 Xb0 1qN0 10L0 1rB0 TX0 1tB0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 WN0 1qL0 11B0 1nX0 1ip0 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 TX0 1tB0 19X0 1a10 1fz0 1a10 1fz0 1cN0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0|28e5",
		"America/Atikokan|CST CDT CWT CPT EST|60 50 50 50 50|0101234|-25TQ0 1in0 Rnb0 3je0 8x30 iw0|28e2",
		"America/Bahia_Banderas|LMT MST CST PST MDT CDT|71 70 60 80 60 50|0121212131414141414141414141414141414152525252525252525252525252525252525252525252525252525252|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nW0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|84e3",
		"America/Bahia|LMT -03 -02|2y.4 30 20|01212121212121212121212121212121212121212121212121212121212121|-2glxp.U HdLp.U 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 l5B0 Rb0|27e5",
		"America/Barbados|LMT BMT AST ADT|3W.t 3W.t 40 30|01232323232|-1Q0I1.v jsM0 1ODC1.v IL0 1ip0 17b0 1ip0 17b0 1ld0 13b0|28e4",
		"America/Belem|LMT -03 -02|3d.U 30 20|012121212121212121212121212121|-2glwK.4 HdKK.4 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0|20e5",
		"America/Belize|LMT CST -0530 CDT|5Q.M 60 5u 50|01212121212121212121212121212121212121212121212121213131|-2kBu7.c fPA7.c Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1f0Mu qn0 lxB0 mn0|57e3",
		"America/Blanc-Sablon|AST ADT AWT APT|40 30 30 30|010230|-25TS0 1in0 UGp0 8x50 iu0|11e2",
		"America/Boa_Vista|LMT -04 -03|42.E 40 30|0121212121212121212121212121212121|-2glvV.k HdKV.k 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 smp0 WL0 1tB0 2L0|62e2",
		"America/Bogota|BMT -05 -04|4U.g 50 40|0121|-2eb73.I 38yo3.I 2en0|90e5",
		"America/Boise|PST PDT MST MWT MPT MDT|80 70 70 60 60 60|0101023425252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-261q0 1nX0 11B0 1nX0 8C10 JCL0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 Dd0 1Kn0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e4",
		"America/Cambridge_Bay|-00 MST MWT MPT MDDT MDT CST CDT EST|0 70 60 60 50 60 60 50 50|0123141515151515151515151515151515151515151515678651515151515151515151515151515151515151515151515151515151515151515151515151|-21Jc0 RO90 8x20 ix0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11A0 1nX0 2K0 WQ0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e2",
		"America/Campo_Grande|LMT -04 -03|3C.s 40 30|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2glwl.w HdLl.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 1C10 Lz0 1Ip0 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0|77e4",
		"America/Cancun|LMT CST EST EDT CDT|5L.4 60 50 40 50|0123232341414141414141414141414141414141412|-1UQG0 2q2o0 yLB0 1lb0 14p0 1lb0 14p0 Lz0 xB0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 Dd0|63e4",
		"America/Caracas|CMT -0430 -04|4r.E 4u 40|01212|-2kV7w.k 28KM2.k 1IwOu kqo0|29e5",
		"America/Cayenne|LMT -04 -03|3t.k 40 30|012|-2mrwu.E 2gWou.E|58e3",
		"America/Panama|CMT EST|5j.A 50|01|-2uduE.o|15e5",
		"America/Chicago|CST CDT EST CWT CPT|60 50 50 50 50|01010101010101010101010101010101010102010101010103401010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 1wp0 TX0 WN0 1qL0 1cN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 11B0 1Hz0 14p0 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 RB0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
		"America/Chihuahua|LMT MST CST CDT MDT|74.k 70 60 50 60|0121212323241414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 2zQN0 1lb0 14p0 1lb0 14q0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|81e4",
		"America/Costa_Rica|SJMT CST CDT|5A.d 60 50|0121212121|-1Xd6n.L 2lu0n.L Db0 1Kp0 Db0 pRB0 15b0 1kp0 mL0|12e5",
		"America/Creston|MST PST|70 80|010|-29DR0 43B0|53e2",
		"America/Cuiaba|LMT -04 -03|3I.k 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2glwf.E HdLf.E 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 4a10 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0|54e4",
		"America/Danmarkshavn|LMT -03 -02 GMT|1e.E 30 20 0|01212121212121212121212121212121213|-2a5WJ.k 2z5fJ.k 19U0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 DC0|8",
		"America/Dawson_Creek|PST PDT PWT PPT MST|80 70 70 70 70|0102301010101010101010101010101010101010101010101010101014|-25TO0 1in0 UGp0 8x10 iy0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 ML0|12e3",
		"America/Dawson|YST YDT YWT YPT YDDT PST PDT|90 80 80 80 70 80 70|0101023040565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-25TN0 1in0 1o10 13V0 Ser0 8x00 iz0 LCL0 1fA0 jrA0 fNd0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|13e2",
		"America/Denver|MST MDT MWT MPT|70 60 60 60|01010101023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261r0 1nX0 11B0 1nX0 11B0 1qL0 WN0 mn0 Ord0 8x20 ix0 LCN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
		"America/Detroit|LMT CST EST EWT EPT EDT|5w.b 60 50 40 40 40|012342525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-2Cgir.N peqr.N 156L0 8x40 iv0 6fd0 11z0 XQp0 1cL0 s10 1Vz0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e5",
		"America/Edmonton|LMT MST MDT MWT MPT|7x.Q 70 60 60 60|01212121212121341212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2yd4q.8 shdq.8 1in0 17d0 hz0 2dB0 1fz0 1a10 11z0 1qN0 WL0 1qN0 11z0 IGN0 8x20 ix0 3NB0 11z0 LFB0 1cL0 3Cp0 1cL0 66N0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|10e5",
		"America/Eirunepe|LMT -05 -04|4D.s 50 40|0121212121212121212121212121212121|-2glvk.w HdLk.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 dPB0 On0 yTd0 d5X0|31e3",
		"America/El_Salvador|LMT CST CDT|5U.M 60 50|012121|-1XiG3.c 2Fvc3.c WL0 1qN0 WL0|11e5",
		"America/Tijuana|LMT MST PST PDT PWT PPT|7M.4 70 80 70 70 70|012123245232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UQE0 4PX0 8mM0 8lc0 SN0 1cL0 pHB0 83r0 zI0 5O10 1Rz0 cOO0 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 BUp0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|20e5",
		"America/Fort_Nelson|PST PDT PWT PPT MST|80 70 70 70 70|01023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010104|-25TO0 1in0 UGp0 8x10 iy0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0|39e2",
		"America/Fort_Wayne|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|010101023010101010101010101040454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 QI10 Db0 RB0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 5Tz0 1o10 qLb0 1cL0 1cN0 1cL0 1qhd0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Fortaleza|LMT -03 -02|2y 30 20|0121212121212121212121212121212121212121|-2glxq HdLq 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 5z0 2mN0 On0|34e5",
		"America/Glace_Bay|LMT AST ADT AWT APT|3X.M 40 30 30 30|012134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsI0.c CwO0.c 1in0 UGp0 8x50 iu0 iq10 11z0 Jg10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|19e3",
		"America/Godthab|LMT -03 -02|3q.U 30 20|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a5Ux.4 2z5dx.4 19U0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e3",
		"America/Goose_Bay|NST NDT NST NDT NWT NPT AST ADT ADDT|3u.Q 2u.Q 3u 2u 2u 2u 40 30 20|010232323232323245232323232323232323232323232323232323232326767676767676767676767676767676767676767676768676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-25TSt.8 1in0 DXb0 2HbX.8 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 WL0 1qN0 WL0 1qN0 7UHu itu 1tB0 WL0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1tB0 WL0 1ld0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 S10 g0u 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14n1 1lb0 14p0 1nW0 11C0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|76e2",
		"America/Grand_Turk|KMT EST EDT AST|57.a 50 40 40|01212121212121212121212121212121212121212121212121212121212121212121212121232121212121212121212121212121212121212121|-2l1uQ.O 2HHBQ.O 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
		"America/Guatemala|LMT CST CDT|62.4 60 50|0121212121|-24KhV.U 2efXV.U An0 mtd0 Nz0 ifB0 17b0 zDB0 11z0|13e5",
		"America/Guayaquil|QMT -05 -04|5e 50 40|0121|-1yVSK 2uILK rz0|27e5",
		"America/Guyana|LMT -0345 -03 -04|3Q.E 3J 30 40|0123|-2dvU7.k 2r6LQ.k Bxbf|80e4",
		"America/Halifax|LMT AST ADT AWT APT|4e.o 40 30 30 30|0121212121212121212121212121212121212121212121212134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsHJ.A xzzJ.A 1db0 3I30 1in0 3HX0 IL0 1E10 ML0 1yN0 Pb0 1Bd0 Mn0 1Bd0 Rz0 1w10 Xb0 1w10 LX0 1w10 Xb0 1w10 Lz0 1C10 Jz0 1E10 OL0 1yN0 Un0 1qp0 Xb0 1qp0 11X0 1w10 Lz0 1HB0 LX0 1C10 FX0 1w10 Xb0 1qp0 Xb0 1BB0 LX0 1td0 Xb0 1qp0 Xb0 Rf0 8x50 iu0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 3Qp0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 3Qp0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 6i10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
		"America/Havana|HMT CST CDT|5t.A 50 40|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1Meuu.o 72zu.o ML0 sld0 An0 1Nd0 Db0 1Nd0 An0 6Ep0 An0 1Nd0 An0 JDd0 Mn0 1Ap0 On0 1fd0 11X0 1qN0 WL0 1wp0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 14n0 1ld0 14L0 1kN0 15b0 1kp0 1cL0 1cN0 1fz0 1a10 1fz0 1fB0 11z0 14p0 1nX0 11B0 1nX0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 14n0 1ld0 14n0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 1a10 1in0 1a10 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 17c0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 11A0 6i00 Rc0 1wo0 U00 1tA0 Rc0 1wo0 U00 1wo0 U00 1zc0 U00 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
		"America/Hermosillo|LMT MST CST PST MDT|7n.Q 70 60 80 60|0121212131414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0|64e4",
		"America/Indiana/Knox|CST CDT CWT CPT EST|60 50 50 50 50|0101023010101010101010101010101010101040101010101010101010101010101010101010101010101010141010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 11z0 1o10 11z0 1o10 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 3Cn0 8wp0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 z8o0 1o00 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Marengo|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101023010101010101010104545454545414545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 dyN0 11z0 6fd0 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 jrz0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1VA0 LA0 1BX0 1e6p0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Petersburg|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010104010101010101010101010141014545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 njX0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 3Fb0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 19co0 1o00 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Tell_City|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010454541010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 g0p0 11z0 1o10 11z0 1qL0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 caL0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Vevay|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|010102304545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 kPB0 Awn0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1lnd0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Vincennes|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010454541014545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 g0p0 11z0 1o10 11z0 1qL0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 caL0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Winamac|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010101010454541054545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 jrz0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1za0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Inuvik|-00 PST PDDT MST MDT|0 80 60 70 60|0121343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-FnA0 tWU0 1fA0 wPe0 2pz0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|35e2",
		"America/Iqaluit|-00 EWT EPT EST EDDT EDT CST CDT|0 40 40 50 30 40 60 50|01234353535353535353535353535353535353535353567353535353535353535353535353535353535353535353535353535353535353535353535353|-16K00 7nX0 iv0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11C0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|67e2",
		"America/Jamaica|KMT EST EDT|57.a 50 40|0121212121212121212121|-2l1uQ.O 2uM1Q.O 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0|94e4",
		"America/Juneau|PST PWT PPT PDT YDT YST AKST AKDT|80 70 70 70 80 90 90 80|01203030303030303030303030403030356767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cM0 1cM0 1cL0 1cN0 1fz0 1a10 1fz0 co0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|33e3",
		"America/Kentucky/Louisville|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101010102301010101010101010101010101454545454545414545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 3Fd0 Nb0 LPd0 11z0 RB0 8x30 iw0 Bb0 10N0 2bB0 8in0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 xz0 gso0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1VA0 LA0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Kentucky/Monticello|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101023010101010101010101010101010101010101010101010101010101010101010101454545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 SWp0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/La_Paz|CMT BST -04|4w.A 3w.A 40|012|-1x37r.o 13b0|19e5",
		"America/Lima|LMT -05 -04|58.A 50 40|0121212121212121|-2tyGP.o 1bDzP.o zX0 1aN0 1cL0 1cN0 1cL0 1PrB0 zX0 1O10 zX0 6Gp0 zX0 98p0 zX0|11e6",
		"America/Los_Angeles|PST PDT PWT PPT|80 70 70 70|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261q0 1nX0 11B0 1nX0 SgN0 8x10 iy0 5Wp1 1VaX 3dA0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
		"America/Maceio|LMT -03 -02|2m.Q 30 20|012121212121212121212121212121212121212121|-2glxB.8 HdLB.8 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 dMN0 Lz0 8Q10 WL0 1tB0 5z0 2mN0 On0|93e4",
		"America/Managua|MMT CST EST CDT|5J.c 60 50 50|0121313121213131|-1quie.M 1yAMe.M 4mn0 9Up0 Dz0 1K10 Dz0 s3F0 1KH0 DB0 9In0 k8p0 19X0 1o30 11y0|22e5",
		"America/Manaus|LMT -04 -03|40.4 40 30|01212121212121212121212121212121|-2glvX.U HdKX.U 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 dPB0 On0|19e5",
		"America/Martinique|FFMT AST ADT|44.k 40 30|0121|-2mPTT.E 2LPbT.E 19X0|39e4",
		"America/Matamoros|LMT CST CDT|6E 60 50|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1UQG0 2FjC0 1nX0 i6p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|45e4",
		"America/Mazatlan|LMT MST CST PST MDT|75.E 70 60 80 60|0121212131414141414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|44e4",
		"America/Menominee|CST CDT CWT CPT EST|60 50 50 50 50|01010230101041010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 LCN0 1fz0 6410 9Jb0 1cM0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|85e2",
		"America/Merida|LMT CST EST CDT|5W.s 60 50 50|0121313131313131313131313131313131313131313131313131313131313131313131313131313131313131|-1UQG0 2q2o0 2hz0 wu30 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|11e5",
		"America/Metlakatla|PST PWT PPT PDT AKST AKDT|80 70 70 70 90 80|01203030303030303030303030303030304545450454545454545454545454545454545454545454|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1hU10 Rd0 1zb0 Op0 1zb0 Op0 1zb0 uM0 jB0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
		"America/Mexico_City|LMT MST CST CDT CWT|6A.A 70 60 50 50|012121232324232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 gEn0 TX0 3xd0 Jb0 6zB0 SL0 e5d0 17b0 1Pff0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|20e6",
		"America/Miquelon|LMT AST -03 -02|3I.E 40 30 20|012323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2mKkf.k 2LTAf.k gQ10 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
		"America/Moncton|EST AST ADT AWT APT|50 40 30 30 30|012121212121212121212134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsH0 CwN0 1in0 zAo0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1K10 Lz0 1zB0 NX0 1u10 Wn0 S20 8x50 iu0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 3Cp0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14n1 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 ReX 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|64e3",
		"America/Monterrey|LMT CST CDT|6F.g 60 50|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1UQG0 2FjC0 1nX0 i6p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|41e5",
		"America/Montevideo|LMT MMT -04 -03 -0330 -0230 -02 -0130|3I.P 3I.P 40 30 3u 2u 20 1u|012343434343434343434343435353636353636375363636363636363636363636363636363636363636363|-2tRUf.9 sVc0 8jcf.9 1db0 1dcu 1cLu 1dcu 1cLu ircu 11zu 1o0u 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 1qMu WLu 1fAu 1cLu 1o0u 11zu NAu 3jXu zXu Dq0u 19Xu pcu jz0 cm10 19X0 6tB0 1fbu 3o0u jX0 4vB0 xz0 3Cp0 mmu 1a10 IMu Db0 4c10 uL0 1Nd0 An0 1SN0 uL0 mp0 28L0 iPB0 un0 1SN0 xz0 1zd0 Lz0 1zd0 Rb0 1zd0 On0 1wp0 Rb0 s8p0 1fB0 1ip0 11z0 1ld0 14n0 1o10 11z0 1o10 11z0 1o10 14n0 1ld0 14n0 1ld0 14n0 1o10 11z0 1o10 11z0 1o10 11z0|17e5",
		"America/Toronto|EST EDT EWT EPT|50 40 40 40|01010101010101010101010101010101010101010101012301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TR0 1in0 11Wu 1nzu 1fD0 WJ0 1wr0 Nb0 1Ap0 On0 1zd0 On0 1wp0 TX0 1tB0 TX0 1tB0 TX0 1tB0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 4kM0 8x40 iv0 1o10 11z0 1nX0 11z0 1o10 11z0 1o10 1qL0 11D0 1nX0 11B0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|65e5",
		"America/Nassau|LMT EST EDT|59.u 50 40|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2kNuO.u 26XdO.u 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|24e4",
		"America/New_York|EST EDT EWT EPT|50 40 40 40|01010101010101010101010101010101010101010101010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261t0 1nX0 11B0 1nX0 11B0 1qL0 1a10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 RB0 8x40 iv0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
		"America/Nipigon|EST EDT EWT EPT|50 40 40 40|010123010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TR0 1in0 Rnb0 3je0 8x40 iv0 19yN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|16e2",
		"America/Nome|NST NWT NPT BST BDT YST AKST AKDT|b0 a0 a0 b0 a0 90 90 80|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17SX0 8wW0 iB0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cl0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|38e2",
		"America/Noronha|LMT -02 -01|29.E 20 10|0121212121212121212121212121212121212121|-2glxO.k HdKO.k 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 2L0 2pB0 On0|30e2",
		"America/North_Dakota/Beulah|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101014545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/North_Dakota/Center|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101014545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14o0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/North_Dakota/New_Salem|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101454545454545454545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14o0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Ojinaga|LMT MST CST CDT MDT|6V.E 70 60 50 60|0121212323241414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 2zQN0 1lb0 14p0 1lb0 14q0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e3",
		"America/Pangnirtung|-00 AST AWT APT ADDT ADT EDT EST CST CDT|0 40 30 30 20 30 40 50 60 50|012314151515151515151515151515151515167676767689767676767676767676767676767676767676767676767676767676767676767676767676767|-1XiM0 PnG0 8x50 iu0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1o00 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11C0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
		"America/Paramaribo|LMT PMT PMT -0330 -03|3E.E 3E.Q 3E.A 3u 30|01234|-2nDUj.k Wqo0.c qanX.I 1yVXN.o|24e4",
		"America/Phoenix|MST MDT MWT|70 60 60|01010202010|-261r0 1nX0 11B0 1nX0 SgN0 4Al1 Ap0 1db0 SWqX 1cL0|42e5",
		"America/Port-au-Prince|PPMT EST EDT|4N 50 40|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-28RHb 2FnMb 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14q0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 i6n0 1nX0 11B0 1nX0 d430 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
		"America/Rio_Branco|LMT -05 -04|4v.c 50 40|01212121212121212121212121212121|-2glvs.M HdLs.M 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 NBd0 d5X0|31e4",
		"America/Porto_Velho|LMT -04 -03|4f.A 40 30|012121212121212121212121212121|-2glvI.o HdKI.o 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0|37e4",
		"America/Puerto_Rico|AST AWT APT|40 30 30|0120|-17lU0 7XT0 iu0|24e5",
		"America/Punta_Arenas|SMT -05 -04 -03|4G.K 50 40 30|0102021212121212121232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-2q2jh.e fJAh.e 5knG.K 1Vzh.e jRAG.K 1pbh.e 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 nHX0 op0 blz0 ko0 Qeo0 WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0",
		"America/Rainy_River|CST CDT CWT CPT|60 50 50 50|010123010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TQ0 1in0 Rnb0 3je0 8x30 iw0 19yN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|842",
		"America/Rankin_Inlet|-00 CST CDDT CDT EST|0 60 40 50 50|012131313131313131313131313131313131313131313431313131313131313131313131313131313131313131313131313131313131313131313131|-vDc0 keu0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e2",
		"America/Recife|LMT -03 -02|2j.A 30 20|0121212121212121212121212121212121212121|-2glxE.o HdLE.o 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 2L0 2pB0 On0|33e5",
		"America/Regina|LMT MST MDT MWT MPT CST|6W.A 70 60 60 60 60|012121212121212121212121341212121212121212121212121215|-2AD51.o uHe1.o 1in0 s2L0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 66N0 1cL0 1cN0 19X0 1fB0 1cL0 1fB0 1cL0 1cN0 1cL0 M30 8x20 ix0 1ip0 1cL0 1ip0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 3NB0 1cL0 1cN0|19e4",
		"America/Resolute|-00 CST CDDT CDT EST|0 60 40 50 50|012131313131313131313131313131313131313131313431313131313431313131313131313131313131313131313131313131313131313131313131|-SnA0 GWS0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|229",
		"America/Santarem|LMT -04 -03|3C.M 40 30|0121212121212121212121212121212|-2glwl.c HdLl.c 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 NBd0|21e4",
		"America/Santiago|SMT -05 -04 -03|4G.K 50 40 30|010202121212121212321232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-2q2jh.e fJAh.e 5knG.K 1Vzh.e jRAG.K 1pbh.e 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 nHX0 op0 9Bz0 jb0 1oN0 ko0 Qeo0 WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0|62e5",
		"America/Santo_Domingo|SDMT EST EDT -0430 AST|4E 50 40 4u 40|01213131313131414|-1ttjk 1lJMk Mn0 6sp0 Lbu 1Cou yLu 1RAu wLu 1QMu xzu 1Q0u xXu 1PAu 13jB0 e00|29e5",
		"America/Sao_Paulo|LMT -03 -02|36.s 30 20|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2glwR.w HdKR.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 pTd0 PX0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 1C10 Lz0 1Ip0 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1HB0 FX0|20e6",
		"America/Scoresbysund|LMT -02 -01 +00|1r.Q 20 10 0|0121323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2a5Ww.8 2z5ew.8 1a00 1cK0 1cL0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|452",
		"America/Sitka|PST PWT PPT PDT YST AKST AKDT|80 70 70 70 90 90 80|01203030303030303030303030303030345656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 co0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|90e2",
		"America/St_Johns|NST NDT NST NDT NWT NPT NDDT|3u.Q 2u.Q 3u 2u 2u 2u 1u|01010101010101010101010101010101010102323232323232324523232323232323232323232323232323232323232323232323232323232323232323232323232323232326232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-28oit.8 14L0 1nB0 1in0 1gm0 Dz0 1JB0 1cL0 1cN0 1cL0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 1cL0 1cN0 1cL0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 1cL0 1fB0 19X0 1fB0 19X0 10O0 eKX.8 19X0 1iq0 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 WL0 1qN0 WL0 1qN0 7UHu itu 1tB0 WL0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1tB0 WL0 1ld0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14n1 1lb0 14p0 1nW0 11C0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
		"America/Swift_Current|LMT MST MDT MWT MPT CST|7b.k 70 60 60 60 60|012134121212121212121215|-2AD4M.E uHdM.E 1in0 UGp0 8x20 ix0 1o10 17b0 1ip0 11z0 1o10 11z0 1o10 11z0 isN0 1cL0 3Cp0 1cL0 1cN0 11z0 1qN0 WL0 pMp0|16e3",
		"America/Tegucigalpa|LMT CST CDT|5M.Q 60 50|01212121|-1WGGb.8 2ETcb.8 WL0 1qN0 WL0 GRd0 AL0|11e5",
		"America/Thule|LMT AST ADT|4z.8 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a5To.Q 31NBo.Q 1cL0 1cN0 1cL0 1fB0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|656",
		"America/Thunder_Bay|CST EST EWT EPT EDT|60 50 40 40 40|0123141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141|-2q5S0 1iaN0 8x40 iv0 XNB0 1cL0 1cN0 1fz0 1cN0 1cL0 3Cp0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
		"America/Vancouver|PST PDT PWT PPT|80 70 70 70|0102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TO0 1in0 UGp0 8x10 iy0 1o10 17b0 1ip0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
		"America/Whitehorse|YST YDT YWT YPT YDDT PST PDT|90 80 80 80 70 80 70|0101023040565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-25TN0 1in0 1o10 13V0 Ser0 8x00 iz0 LCL0 1fA0 3NA0 vrd0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e3",
		"America/Winnipeg|CST CDT CWT CPT|60 50 50 50|010101023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aIi0 WL0 3ND0 1in0 Jap0 Rb0 aCN0 8x30 iw0 1tB0 11z0 1ip0 11z0 1o10 11z0 1o10 11z0 1rd0 10L0 1op0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 1cL0 1cN0 11z0 6i10 WL0 6i10 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|66e4",
		"America/Yakutat|YST YWT YPT YDT AKST AKDT|90 80 80 80 90 80|01203030303030303030303030303030304545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-17T10 8x00 iz0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cn0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|642",
		"America/Yellowknife|-00 MST MWT MPT MDDT MDT|0 70 60 60 50 60|012314151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151|-1pdA0 hix0 8x20 ix0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|19e3",
		"Antarctica/Casey|-00 +08 +11|0 -80 -b0|01212121|-2q00 1DjS0 T90 40P0 KL0 blz0 3m10|10",
		"Antarctica/Davis|-00 +07 +05|0 -70 -50|01012121|-vyo0 iXt0 alj0 1D7v0 VB0 3Wn0 KN0|70",
		"Antarctica/DumontDUrville|-00 +10|0 -a0|0101|-U0o0 cfq0 bFm0|80",
		"Antarctica/Macquarie|AEST AEDT -00 +11|-a0 -b0 0 -b0|0102010101010101010101010101010101010101010101010101010101010101010101010101010101010101013|-29E80 19X0 4SL0 1ayy0 Lvs0 1cM0 1o00 Rc0 1wo0 Rc0 1wo0 U00 1wo0 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0|1",
		"Antarctica/Mawson|-00 +06 +05|0 -60 -50|012|-CEo0 2fyk0|60",
		"Pacific/Auckland|NZMT NZST NZST NZDT|-bu -cu -c0 -d0|01020202020202020202020202023232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-1GCVu Lz0 1tB0 11zu 1o0u 11zu 1o0u 11zu 1o0u 14nu 1lcu 14nu 1lcu 1lbu 11Au 1nXu 11Au 1nXu 11Au 1nXu 11Au 1nXu 11Au 1qLu WMu 1qLu 11Au 1n1bu IM0 1C00 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1qM0 14o0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1io0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|14e5",
		"Antarctica/Palmer|-00 -03 -04 -02|0 30 40 20|0121212121213121212121212121212121212121212121212121212121212121212121212121212121|-cao0 nD0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 jsN0 14N0 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0|40",
		"Antarctica/Rothera|-00 -03|0 30|01|gOo0|130",
		"Antarctica/Syowa|-00 +03|0 -30|01|-vs00|20",
		"Antarctica/Troll|-00 +00 +02|0 0 -20|01212121212121212121212121212121212121212121212121212121212121212121|1puo0 hd0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|40",
		"Antarctica/Vostok|-00 +06|0 -60|01|-tjA0|25",
		"Europe/Oslo|CET CEST|-10 -20|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2awM0 Qm0 W6o0 5pf0 WM0 1fA0 1cM0 1cM0 1cM0 1cM0 wJc0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1qM0 WM0 zpc0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|62e4",
		"Asia/Riyadh|LMT +03|-36.Q -30|01|-TvD6.Q|57e5",
		"Asia/Almaty|LMT +05 +06 +07|-57.M -50 -60 -70|012323232323232323232321232323232323232323232323232|-1Pc57.M eUo7.M 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0|15e5",
		"Asia/Amman|LMT EET EEST|-2n.I -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1yW2n.I 1HiMn.I KL0 1oN0 11b0 1oN0 11b0 1pd0 1dz0 1cp0 11b0 1op0 11b0 fO10 1db0 1e10 1cL0 1cN0 1cL0 1cN0 1fz0 1pd0 10n0 1ld0 14n0 1hB0 15b0 1ip0 19X0 1cN0 1cL0 1cN0 17b0 1ld0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1So0 y00 1fc0 1dc0 1co0 1dc0 1cM0 1cM0 1cM0 1o00 11A0 1lc0 17c0 1cM0 1cM0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 4bX0 Dd0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|25e5",
		"Asia/Anadyr|LMT +12 +13 +14 +11|-bN.U -c0 -d0 -e0 -b0|01232121212121212121214121212121212121212121212121212121212141|-1PcbN.U eUnN.U 23CL0 1db0 2q10 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|13e3",
		"Asia/Aqtau|LMT +04 +05 +06|-3l.4 -40 -50 -60|012323232323232323232123232312121212121212121212|-1Pc3l.4 eUnl.4 24PX0 2pX0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|15e4",
		"Asia/Aqtobe|LMT +04 +05 +06|-3M.E -40 -50 -60|0123232323232323232321232323232323232323232323232|-1Pc3M.E eUnM.E 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0|27e4",
		"Asia/Ashgabat|LMT +04 +05 +06|-3R.w -40 -50 -60|0123232323232323232323212|-1Pc3R.w eUnR.w 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0|41e4",
		"Asia/Atyrau|LMT +03 +05 +06 +04|-3r.I -30 -50 -60 -40|01232323232323232323242323232323232324242424242|-1Pc3r.I eUor.I 24PW0 2pX0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 2sp0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0",
		"Asia/Baghdad|BMT +03 +04|-2V.A -30 -40|012121212121212121212121212121212121212121212121212121|-26BeV.A 2ACnV.A 11b0 1cp0 1dz0 1dd0 1db0 1cN0 1cp0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1de0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0|66e5",
		"Asia/Qatar|LMT +04 +03|-3q.8 -40 -30|012|-21Jfq.8 27BXq.8|96e4",
		"Asia/Baku|LMT +03 +04 +05|-3j.o -30 -40 -50|01232323232323232323232123232323232323232323232323232323232323232|-1Pc3j.o 1jUoj.o WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 1cM0 9Je0 1o00 11z0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|27e5",
		"Asia/Bangkok|BMT +07|-6G.4 -70|01|-218SG.4|15e6",
		"Asia/Barnaul|LMT +06 +07 +08|-5z -60 -70 -80|0123232323232323232323212323232321212121212121212121212121212121212|-21S5z pCnz 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 p90 LE0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0",
		"Asia/Beirut|EET EEST|-20 -30|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-21aq0 1on0 1410 1db0 19B0 1in0 1ip0 WL0 1lQp0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 q6N0 En0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1op0 11b0 dA10 17b0 1iN0 17b0 1iN0 17b0 1iN0 17b0 1vB0 SL0 1mp0 13z0 1iN0 17b0 1iN0 17b0 1jd0 12n0 1a10 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|22e5",
		"Asia/Bishkek|LMT +05 +06 +07|-4W.o -50 -60 -70|012323232323232323232321212121212121212121212121212|-1Pc4W.o eUnW.o 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2e00 1tX0 17b0 1ip0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1cPu 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0|87e4",
		"Asia/Brunei|LMT +0730 +08|-7D.E -7u -80|012|-1KITD.E gDc9.E|42e4",
		"Asia/Kolkata|MMT IST +0630|-5l.a -5u -6u|012121|-2zOtl.a 1r2LP.a 1un0 HB0 7zX0|15e6",
		"Asia/Chita|LMT +08 +09 +10|-7x.Q -80 -90 -a0|012323232323232323232321232323232323232323232323232323232323232312|-21Q7x.Q pAnx.Q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3re0|33e4",
		"Asia/Choibalsan|LMT +07 +08 +10 +09|-7C -70 -80 -a0 -90|0123434343434343434343434343434343434343434343424242|-2APHC 2UkoC cKn0 1da0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 3Db0 h1f0 1cJ0 1cP0 1cJ0|38e3",
		"Asia/Shanghai|CST CDT|-80 -90|010101010101010101010101010|-1c2w0 Rz0 11d0 1wL0 A10 8HX0 1G10 Tz0 1ip0 1jX0 1cN0 11b0 1oN0 aL0 1tU30 Rb0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0|23e6",
		"Asia/Colombo|MMT +0530 +06 +0630|-5j.w -5u -60 -6u|01231321|-2zOtj.w 1rFbN.w 1zzu 7Apu 23dz0 11zu n3cu|22e5",
		"Asia/Dhaka|HMT +0630 +0530 +06 +07|-5R.k -6u -5u -60 -70|0121343|-18LFR.k 1unn.k HB0 m6n0 2kxbu 1i00|16e6",
		"Asia/Damascus|LMT EET EEST|-2p.c -20 -30|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-21Jep.c Hep.c 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1xRB0 11X0 1oN0 10L0 1pB0 11b0 1oN0 10L0 1mp0 13X0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 Nb0 1AN0 Nb0 bcp0 19X0 1gp0 19X0 3ld0 1xX0 Vd0 1Bz0 Sp0 1vX0 10p0 1dz0 1cN0 1cL0 1db0 1db0 1g10 1an0 1ap0 1db0 1fd0 1db0 1cN0 1db0 1dd0 1db0 1cp0 1dz0 1c10 1dX0 1cN0 1db0 1dd0 1db0 1cN0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1db0 1cN0 1db0 1cN0 19z0 1fB0 1qL0 11B0 1on0 Wp0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0|26e5",
		"Asia/Dili|LMT +08 +09|-8m.k -80 -90|01212|-2le8m.k 1dnXm.k 1nfA0 Xld0|19e4",
		"Asia/Dubai|LMT +04|-3F.c -40|01|-21JfF.c|39e5",
		"Asia/Dushanbe|LMT +05 +06 +07|-4z.c -50 -60 -70|012323232323232323232321|-1Pc4z.c eUnz.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2hB0|76e4",
		"Asia/Famagusta|LMT EET EEST +03|-2f.M -20 -30 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212312121212121212121212121212121212121212121|-1Vc2f.M 2a3cf.M 1cL0 1qp0 Xz0 19B0 19X0 1fB0 1db0 1cp0 1cL0 1fB0 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1o30 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"Asia/Gaza|EET EEST IST IDT|-20 -30 -20 -30|0101010101010101010101010101010123232323232323232323232323232320101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-1c2q0 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 pBd0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 dW0 hfB0 Db0 1fB0 Rb0 bXd0 gM0 8Q00 IM0 1wM0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 M10 C00 17c0 1io0 17c0 1io0 17c0 1o00 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 17c0 1io0 18N0 1bz0 19z0 1gp0 1610 1iL0 11z0 1o10 14o0 1lA1 SKX 1xd1 MKX 1AN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11c0 1oo0 11c0 1rc0 Wo0 1rc0 Wo0 1rc0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1rc0 Wo0 1rc0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1rc0 Wo0 1rc0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1rc0|18e5",
		"Asia/Hebron|EET EEST IST IDT|-20 -30 -20 -30|010101010101010101010101010101012323232323232323232323232323232010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-1c2q0 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 pBd0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 dW0 hfB0 Db0 1fB0 Rb0 bXd0 gM0 8Q00 IM0 1wM0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 M10 C00 17c0 1io0 17c0 1io0 17c0 1o00 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 17c0 1io0 18N0 1bz0 19z0 1gp0 1610 1iL0 12L0 1mN0 14o0 1lc0 Tb0 1xd1 MKX bB0 cn0 1cN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 WN0 1qL0 11c0 1oo0 11c0 1rc0 Wo0 1rc0 Wo0 1rc0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1rc0 Wo0 1rc0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1rc0 Wo0 1rc0 11c0 1oo0 11c0 1oo0 11c0 1oo0 11c0 1rc0|25e4",
		"Asia/Ho_Chi_Minh|LMT PLMT +07 +08 +09|-76.E -76.u -70 -80 -90|0123423232|-2yC76.E bK00.a 1h7b6.u 5lz0 18o0 3Oq0 k5b0 aW00 BAM0|90e5",
		"Asia/Hong_Kong|LMT HKT HKST HKT JST|-7A.G -80 -90 -8u -90|0123412121212121212121212121212121212121212121212121212121212121212121|-2CFH0 1taO0 Hc0 xUu 9tBu 11z0 1tDu Rc0 1wo0 11A0 1cM0 11A0 1o00 11A0 1o00 11A0 1o00 14o0 1o00 11A0 1nX0 U10 1tz0 U10 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1wn0 Rd0 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 17d0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 s10 1Vz0 1cN0 1cL0 1cN0 1cL0 6fd0 14n0|73e5",
		"Asia/Hovd|LMT +06 +07 +08|-66.A -60 -70 -80|012323232323232323232323232323232323232323232323232|-2APG6.A 2Uko6.A cKn0 1db0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 kEp0 1cJ0 1cP0 1cJ0|81e3",
		"Asia/Irkutsk|IMT +07 +08 +09|-6V.5 -70 -80 -90|01232323232323232323232123232323232323232323232323232323232323232|-21zGV.5 pjXV.5 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|60e4",
		"Europe/Istanbul|IMT EET EEST +04 +03|-1U.U -20 -30 -40 -30|012121212121212121212121212121212121212121212121212121234343434342121212121212121212121212121212121212121212121212121212121212124|-2ogNU.U dzzU.U 11b0 8tB0 1on0 1410 1db0 19B0 1in0 3Rd0 Un0 1oN0 11b0 zSp0 CL0 mN0 1Vz0 1gN0 1pz0 5Rd0 1fz0 1yp0 ML0 1kp0 17b0 1ip0 17b0 1fB0 19X0 1jB0 18L0 1ip0 17z0 qdd0 xX0 3S10 Tz0 dA10 11z0 1o10 11z0 1qN0 11z0 1ze0 11B0 WM0 1qO0 WI0 1nX0 1rB0 10L0 11B0 1in0 17d0 1in0 2pX0 19E0 1fU0 16Q0 1iI0 16Q0 1iI0 1Vd0 pb0 3Kp0 14o0 1de0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1a00 1fA0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WO0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 Xc0 1qo0 WM0 1qM0 11A0 1o00 1200 1nA0 11A0 1tA0 U00 15w0|13e6",
		"Asia/Jakarta|BMT +0720 +0730 +09 +08 WIB|-77.c -7k -7u -90 -80 -70|01232425|-1Q0Tk luM0 mPzO 8vWu 6kpu 4PXu xhcu|31e6",
		"Asia/Jayapura|LMT +09 +0930 WIT|-9m.M -90 -9u -90|0123|-1uu9m.M sMMm.M L4nu|26e4",
		"Asia/Jerusalem|JMT IST IDT IDDT|-2k.E -20 -30 -40|012121212121321212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-26Bek.E SyMk.E 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 3LB0 Em0 or0 1cn0 1dB0 16n0 10O0 1ja0 1tC0 14o0 1cM0 1a00 11A0 1Na0 An0 1MP0 AJ0 1Kp0 LC0 1oo0 Wl0 EQN0 Db0 1fB0 Rb0 bXd0 gM0 8Q00 IM0 1wM0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 1hB0 1dX0 1ep0 1aL0 1eN0 17X0 1nf0 11z0 1tB0 19W0 1e10 17b0 1ep0 1gL0 18N0 1fz0 1eN0 17b0 1gq0 1gn0 19d0 1dz0 1c10 17X0 1hB0 1gn0 19d0 1dz0 1c10 17X0 1kp0 1dz0 1c10 1aL0 1eN0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0|81e4",
		"Asia/Kabul|+04 +0430|-40 -4u|01|-10Qs0|46e5",
		"Asia/Kamchatka|LMT +11 +12 +13|-ay.A -b0 -c0 -d0|012323232323232323232321232323232323232323232323232323232323212|-1SLKy.A ivXy.A 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|18e4",
		"Asia/Karachi|LMT +0530 +0630 +05 PKT PKST|-4s.c -5u -6u -50 -50 -60|012134545454|-2xoss.c 1qOKW.c 7zX0 eup0 LqMu 1fy00 1cL0 dK10 11b0 1610 1jX0|24e6",
		"Asia/Urumqi|LMT +06|-5O.k -60|01|-1GgtO.k|32e5",
		"Asia/Kathmandu|LMT +0530 +0545|-5F.g -5u -5J|012|-21JhF.g 2EGMb.g|12e5",
		"Asia/Khandyga|LMT +08 +09 +10 +11|-92.d -80 -90 -a0 -b0|0123232323232323232323212323232323232323232323232343434343434343432|-21Q92.d pAp2.d 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 qK0 yN0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 17V0 7zD0|66e2",
		"Asia/Krasnoyarsk|LMT +06 +07 +08|-6b.q -60 -70 -80|01232323232323232323232123232323232323232323232323232323232323232|-21Hib.q prAb.q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|10e5",
		"Asia/Kuala_Lumpur|SMT +07 +0720 +0730 +09 +08|-6T.p -70 -7k -7u -90 -80|0123435|-2Bg6T.p 17anT.p l5XE 17bO 8Fyu 1so1u|71e5",
		"Asia/Kuching|LMT +0730 +08 +0820 +09|-7l.k -7u -80 -8k -90|0123232323232323242|-1KITl.k gDbP.k 6ynu AnE 1O0k AnE 1NAk AnE 1NAk AnE 1NAk AnE 1O0k AnE 1NAk AnE pAk 8Fz0|13e4",
		"Asia/Macau|LMT CST +09 +10 CDT|-7y.a -80 -90 -a0 -90|012323214141414141414141414141414141414141414141414141414141414141414141|-2CFHy.a 1uqKy.a PX0 1kn0 15B0 11b0 4Qq0 1oM0 11c0 1ko0 1u00 11A0 1cM0 11c0 1o00 11A0 1o00 11A0 1oo0 1400 1o00 11A0 1o00 U00 1tA0 U00 1wo0 Rc0 1wru U10 1tz0 U10 1tz0 U10 1tz0 U10 1wn0 Rd0 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 17d0 1cK0 1cO0 1cK0 1cO0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 s10 1Vz0 1cN0 1cL0 1cN0 1cL0 6fd0 14n0|57e4",
		"Asia/Magadan|LMT +10 +11 +12|-a3.c -a0 -b0 -c0|012323232323232323232321232323232323232323232323232323232323232312|-1Pca3.c eUo3.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3Cq0|95e3",
		"Asia/Makassar|LMT MMT +08 +09 WITA|-7V.A -7V.A -80 -90 -80|01234|-21JjV.A vfc0 myLV.A 8ML0|15e5",
		"Asia/Manila|PST PDT JST|-80 -90 -90|010201010|-1kJI0 AL0 cK10 65X0 mXB0 vX0 VK10 1db0|24e6",
		"Asia/Nicosia|LMT EET EEST|-2d.s -20 -30|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1Vc2d.s 2a3cd.s 1cL0 1qp0 Xz0 19B0 19X0 1fB0 1db0 1cp0 1cL0 1fB0 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1o30 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|32e4",
		"Asia/Novokuznetsk|LMT +06 +07 +08|-5M.M -60 -70 -80|012323232323232323232321232323232323232323232323232323232323212|-1PctM.M eULM.M 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|55e4",
		"Asia/Novosibirsk|LMT +06 +07 +08|-5v.E -60 -70 -80|0123232323232323232323212323212121212121212121212121212121212121212|-21Qnv.E pAFv.E 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 ml0 Os0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 4eN0|15e5",
		"Asia/Omsk|LMT +05 +06 +07|-4R.u -50 -60 -70|01232323232323232323232123232323232323232323232323232323232323232|-224sR.u pMLR.u 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|12e5",
		"Asia/Oral|LMT +03 +05 +06 +04|-3p.o -30 -50 -60 -40|01232323232323232424242424242424242424242424242|-1Pc3p.o eUop.o 23CK0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 1cM0 IM0 1EM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|27e4",
		"Asia/Pontianak|LMT PMT +0730 +09 +08 WITA WIB|-7h.k -7h.k -7u -90 -80 -80 -70|012324256|-2ua7h.k XE00 munL.k 8Rau 6kpu 4PXu xhcu Wqnu|23e4",
		"Asia/Pyongyang|LMT KST JST KST|-8n -8u -90 -90|012313|-2um8n 97XR 1lTzu 2Onc0 6BA0|29e5",
		"Asia/Qostanay|LMT +04 +05 +06|-4e.s -40 -50 -60|012323232323232323232123232323232323232323232323|-1Pc4e.s eUoe.s 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0",
		"Asia/Qyzylorda|LMT +04 +05 +06|-4l.Q -40 -50 -60|01232323232323232323232323232323232323232323232|-1Pc4l.Q eUol.Q 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 3ao0 1EM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 zQl0|73e4",
		"Asia/Rangoon|RMT +0630 +09|-6o.L -6u -90|0121|-21Jio.L SmnS.L 7j9u|48e5",
		"Asia/Sakhalin|LMT +09 +11 +12 +10|-9u.M -90 -b0 -c0 -a0|01232323232323232323232423232323232424242424242424242424242424242|-2AGVu.M 1BoMu.M 1qFa0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 2pB0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0|58e4",
		"Asia/Samarkand|LMT +04 +05 +06|-4r.R -40 -50 -60|01232323232323232323232|-1Pc4r.R eUor.R 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0|36e4",
		"Asia/Seoul|LMT KST JST KST KDT KDT|-8r.Q -8u -90 -90 -9u -a0|0123141414141414135353|-2um8r.Q 97XV.Q 1m1zu kKo0 2I0u OL0 1FB0 Rb0 1qN0 TX0 1tB0 TX0 1tB0 TX0 1tB0 TX0 2ap0 12FBu 11A0 1o00 11A0|23e6",
		"Asia/Srednekolymsk|LMT +10 +11 +12|-ae.Q -a0 -b0 -c0|01232323232323232323232123232323232323232323232323232323232323232|-1Pcae.Q eUoe.Q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|35e2",
		"Asia/Taipei|CST JST CDT|-80 -90 -90|01020202020202020202020202020202020202020|-1iw80 joM0 1yo0 Tz0 1ip0 1jX0 1cN0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 10N0 1BX0 10p0 1pz0 10p0 1pz0 10p0 1db0 1dd0 1db0 1cN0 1db0 1cN0 1db0 1cN0 1db0 1BB0 ML0 1Bd0 ML0 uq10 1db0 1cN0 1db0 97B0 AL0|74e5",
		"Asia/Tashkent|LMT +05 +06 +07|-4B.b -50 -60 -70|012323232323232323232321|-1Pc4B.b eUnB.b 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0|23e5",
		"Asia/Tbilisi|TBMT +03 +04 +05|-2X.b -30 -40 -50|0123232323232323232323212121232323232323232323212|-1Pc2X.b 1jUnX.b WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 1cK0 1cL0 1cN0 1cL0 1cN0 2pz0 1cL0 1fB0 3Nz0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 An0 Os0 WM0|11e5",
		"Asia/Tehran|LMT TMT +0330 +04 +05 +0430|-3p.I -3p.I -3u -40 -50 -4u|01234325252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-2btDp.I 1d3c0 1huLT.I TXu 1pz0 sN0 vAu 1cL0 1dB0 1en0 pNB0 UL0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 64p0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
		"Asia/Thimphu|LMT +0530 +06|-5W.A -5u -60|012|-Su5W.A 1BGMs.A|79e3",
		"Asia/Tokyo|JST JDT|-90 -a0|010101010|-QJJ0 Rb0 1ld0 14n0 1zd0 On0 1zd0 On0|38e6",
		"Asia/Tomsk|LMT +06 +07 +08|-5D.P -60 -70 -80|0123232323232323232323212323232323232323232323212121212121212121212|-21NhD.P pxzD.P 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 co0 1bB0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3Qp0|10e5",
		"Asia/Ulaanbaatar|LMT +07 +08 +09|-77.w -70 -80 -90|012323232323232323232323232323232323232323232323232|-2APH7.w 2Uko7.w cKn0 1db0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 kEp0 1cJ0 1cP0 1cJ0|12e5",
		"Asia/Ust-Nera|LMT +08 +09 +12 +11 +10|-9w.S -80 -90 -c0 -b0 -a0|012343434343434343434345434343434343434343434343434343434343434345|-21Q9w.S pApw.S 23CL0 1d90 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 17V0 7zD0|65e2",
		"Asia/Vladivostok|LMT +09 +10 +11|-8L.v -90 -a0 -b0|01232323232323232323232123232323232323232323232323232323232323232|-1SJIL.v itXL.v 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|60e4",
		"Asia/Yakutsk|LMT +08 +09 +10|-8C.W -80 -90 -a0|01232323232323232323232123232323232323232323232323232323232323232|-21Q8C.W pAoC.W 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|28e4",
		"Asia/Yekaterinburg|LMT PMT +04 +05 +06|-42.x -3J.5 -40 -50 -60|012343434343434343434343234343434343434343434343434343434343434343|-2ag42.x 7mQh.s qBvJ.5 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|14e5",
		"Asia/Yerevan|LMT +03 +04 +05|-2W -30 -40 -50|0123232323232323232323212121212323232323232323232323232323232|-1Pc2W 1jUnW WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 4RX0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|13e5",
		"Atlantic/Azores|HMT -02 -01 +00 WET|1S.w 20 10 0 0|01212121212121212121212121212121212121212121232123212321232121212121212121212121212121212121212121232323232323232323232323232323234323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2ldW0 aPX0 Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 qIl0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cL0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|25e4",
		"Atlantic/Bermuda|LMT AST ADT|4j.i 40 30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1BnRE.G 1LTbE.G 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|65e3",
		"Atlantic/Canary|LMT -01 WET WEST|11.A 10 0 -10|01232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UtaW.o XPAW.o 1lAK0 1a10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Atlantic/Cape_Verde|LMT -02 -01|1y.4 20 10|01212|-2ldW0 1eEo0 7zX0 1djf0|50e4",
		"Atlantic/Faroe|LMT WET WEST|r.4 0 -10|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2uSnw.U 2Wgow.U 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|49e3",
		"Atlantic/Madeira|FMT -01 +00 +01 WET WEST|17.A 10 0 -10 0 -10|01212121212121212121212121212121212121212121232123212321232121212121212121212121212121212121212121454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-2ldX0 aPX0 Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 qIl0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|27e4",
		"Atlantic/Reykjavik|LMT -01 +00 GMT|1s 10 0 0|012121212121212121212121212121212121212121212121212121212121212121213|-2uWmw mfaw 1Bd0 ML0 1LB0 Cn0 1LB0 3fX0 C10 HrX0 1cO0 LB0 1EL0 LA0 1C00 Oo0 1wo0 Rc0 1wo0 Rc0 1wo0 Rc0 1zc0 Oo0 1zc0 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0|12e4",
		"Atlantic/South_Georgia|-02|20|0||30",
		"Atlantic/Stanley|SMT -04 -03 -02|3P.o 40 30 20|012121212121212323212121212121212121212121212121212121212121212121212|-2kJw8.A 12bA8.A 19X0 1fB0 19X0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 Cn0 1Cc10 WL0 1qL0 U10 1tz0 2mN0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1tz0 U10 1tz0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1tz0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qN0 U10 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1wn0 U10 1tz0 U10 1tz0 U10|21e2",
		"Australia/Sydney|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 14o0 1o00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 11A0 1o00 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|40e5",
		"Australia/Adelaide|ACST ACDT|-9u -au|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 Oo0 1zc0 WM0 1qM0 Rc0 1zc0 U00 1tA0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|11e5",
		"Australia/Brisbane|AEST AEDT|-a0 -b0|01010101010101010|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 H1A0 Oo0 1zc0 Oo0 1zc0 Oo0|20e5",
		"Australia/Broken_Hill|ACST ACDT|-9u -au|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 14o0 1o00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|18e3",
		"Australia/Currie|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-29E80 19X0 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|746",
		"Australia/Darwin|ACST ACDT|-9u -au|010101010|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0|12e4",
		"Australia/Eucla|+0845 +0945|-8J -9J|0101010101010101010|-293kI xcX 10jd0 yL0 1cN0 1cL0 1gSp0 Oo0 l5A0 Oo0 iJA0 G00 zU00 IM0 1qM0 11A0 1o00 11A0|368",
		"Australia/Hobart|AEST AEDT|-a0 -b0|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-29E80 19X0 10jd0 yL0 1cN0 1cL0 1fB0 19X0 VfB0 1cM0 1o00 Rc0 1wo0 Rc0 1wo0 U00 1wo0 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|21e4",
		"Australia/Lord_Howe|AEST +1030 +1130 +11|-a0 -au -bu -b0|0121212121313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313|raC0 1zdu Rb0 1zd0 On0 1zd0 On0 1zd0 On0 1zd0 TXu 1qMu WLu 1tAu WLu 1tAu TXu 1tAu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu 11zu 1o0u 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 11Au 1nXu 1qMu 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 1qMu 11zu 1o0u WLu 1qMu 14nu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu|347",
		"Australia/Lindeman|AEST AEDT|-a0 -b0|010101010101010101010|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 H1A0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0|10",
		"Australia/Melbourne|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1qM0 11A0 1tA0 U00 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 11A0 1o00 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|39e5",
		"Australia/Perth|AWST AWDT|-80 -90|0101010101010101010|-293jX xcX 10jd0 yL0 1cN0 1cL0 1gSp0 Oo0 l5A0 Oo0 iJA0 G00 zU00 IM0 1qM0 11A0 1o00 11A0|18e5",
		"CET|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"Pacific/Easter|EMT -07 -06 -05|7h.s 70 60 50|012121212121212121212121212123232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-1uSgG.w 1s4IG.w WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 2pA0 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1zb0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0|30e2",
		"CST6CDT|CST CDT CWT CPT|60 50 50 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"EET|EET EEST|-20 -30|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|hDB0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"Europe/Dublin|DMT IST GMT BST IST|p.l -y.D 0 -10 -10|01232323232324242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242|-2ax9y.D Rc0 1fzy.D 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 g600 14o0 1wo0 17c0 1io0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1a00 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1tA0 IM0 90o0 U00 1tA0 U00 1tA0 U00 1tA0 U00 1tA0 WM0 1qM0 WM0 1qM0 WM0 1tA0 U00 1tA0 U00 1tA0 11z0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 14o0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"EST|EST|50|0|",
		"EST5EDT|EST EDT EWT EPT|50 40 40 40|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261t0 1nX0 11B0 1nX0 SgN0 8x40 iv0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Etc/GMT-0|GMT|0|0|",
		"Etc/GMT-1|+01|-10|0|",
		"Pacific/Port_Moresby|+10|-a0|0||25e4",
		"Etc/GMT-11|+11|-b0|0|",
		"Pacific/Tarawa|+12|-c0|0||29e3",
		"Etc/GMT-13|+13|-d0|0|",
		"Etc/GMT-14|+14|-e0|0|",
		"Etc/GMT-2|+02|-20|0|",
		"Etc/GMT-3|+03|-30|0|",
		"Etc/GMT-4|+04|-40|0|",
		"Etc/GMT-5|+05|-50|0|",
		"Etc/GMT-6|+06|-60|0|",
		"Indian/Christmas|+07|-70|0||21e2",
		"Etc/GMT-8|+08|-80|0|",
		"Pacific/Palau|+09|-90|0||21e3",
		"Etc/GMT+1|-01|10|0|",
		"Etc/GMT+10|-10|a0|0|",
		"Etc/GMT+11|-11|b0|0|",
		"Etc/GMT+12|-12|c0|0|",
		"Etc/GMT+3|-03|30|0|",
		"Etc/GMT+4|-04|40|0|",
		"Etc/GMT+5|-05|50|0|",
		"Etc/GMT+6|-06|60|0|",
		"Etc/GMT+7|-07|70|0|",
		"Etc/GMT+8|-08|80|0|",
		"Etc/GMT+9|-09|90|0|",
		"Etc/UTC|UTC|0|0|",
		"Europe/Amsterdam|AMT NST +0120 +0020 CEST CET|-j.w -1j.w -1k -k -20 -10|010101010101010101010101010101010101010101012323234545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545|-2aFcj.w 11b0 1iP0 11A0 1io0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1co0 1io0 1yo0 Pc0 1a00 1fA0 1Bc0 Mo0 1tc0 Uo0 1tA0 U00 1uo0 W00 1s00 VA0 1so0 Vc0 1sM0 UM0 1wo0 Rc0 1u00 Wo0 1rA0 W00 1s00 VA0 1sM0 UM0 1w00 fV0 BCX.w 1tA0 U00 1u00 Wo0 1sm0 601k WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|16e5",
		"Europe/Andorra|WET CET CEST|0 -10 -20|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-UBA0 1xIN0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|79e3",
		"Europe/Astrakhan|LMT +03 +04 +05|-3c.c -30 -40 -50|012323232323232323212121212121212121212121212121212121212121212|-1Pcrc.c eUMc.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0|10e5",
		"Europe/Athens|AMT EET EEST CEST CET|-1y.Q -20 -30 -20 -10|012123434121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a61x.Q CNbx.Q mn0 kU10 9b0 3Es0 Xa0 1fb0 1dd0 k3X0 Nz0 SCp0 1vc0 SO0 1cM0 1a00 1ao0 1fc0 1a10 1fG0 1cg0 1dX0 1bX0 1cQ0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|35e5",
		"Europe/London|GMT BST BDST|0 -10 -20|0101010101010101010101010101010101010101010101010121212121210101210101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2axa0 Rc0 1fA0 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 2Rz0 Dc0 1zc0 Oo0 1zc0 Rc0 1wo0 17c0 1iM0 FA0 xB0 1fA0 1a00 14o0 bb0 LA0 xB0 Rc0 1wo0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1a00 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1tA0 IM0 90o0 U00 1tA0 U00 1tA0 U00 1tA0 U00 1tA0 WM0 1qM0 WM0 1qM0 WM0 1tA0 U00 1tA0 U00 1tA0 11z0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 14o0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|10e6",
		"Europe/Belgrade|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-19RC0 3IP0 WM0 1fA0 1cM0 1cM0 1rc0 Qo0 1vmo0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Berlin|CET CEST CEMT|-10 -20 -30|01010101010101210101210101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 kL0 Nc0 m10 WM0 1ao0 1cp0 dX0 jz0 Dd0 1io0 17c0 1fA0 1a00 1ehA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|41e5",
		"Europe/Prague|CET CEST GMT|-10 -20 0|01010101010101010201010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 1cM0 1qM0 11c0 mp0 xA0 mn0 17c0 1io0 17c0 1fc0 1ao0 1bNc0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|13e5",
		"Europe/Brussels|WET CET CEST WEST|0 -10 -20 -10|0121212103030303030303030303030303030303030303030303212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ehc0 3zX0 11c0 1iO0 11A0 1o00 11A0 my0 Ic0 1qM0 Rc0 1EM0 UM0 1u00 10o0 1io0 1io0 17c0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a30 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 y00 5Wn0 WM0 1fA0 1cM0 16M0 1iM0 16M0 1C00 Uo0 1eeo0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|21e5",
		"Europe/Bucharest|BMT EET EEST|-1I.o -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1xApI.o 20LI.o RA0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Axc0 On0 1fA0 1a10 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cK0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cL0 1cN0 1cL0 1fB0 1nX0 11E0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|19e5",
		"Europe/Budapest|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1ip0 17b0 1op0 1tb0 Q2m0 3Ne0 WM0 1fA0 1cM0 1cM0 1oJ0 1dc0 1030 1fA0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1iM0 1fA0 8Ha0 Rb0 1wN0 Rb0 1BB0 Lz0 1C20 LB0 SNX0 1a10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e5",
		"Europe/Zurich|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-19Lc0 11A0 1o00 11A0 1xG10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|38e4",
		"Europe/Chisinau|CMT BMT EET EEST CEST CET MSK MSD|-1T -1I.o -20 -30 -20 -10 -30 -40|012323232323232323234545467676767676767676767323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-26jdT wGMa.A 20LI.o RA0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 27A0 2en0 39g0 WM0 1fA0 1cM0 V90 1t7z0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 gL0 WO0 1cM0 1cM0 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1nX0 11D0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|67e4",
		"Europe/Copenhagen|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2azC0 Tz0 VuO0 60q0 WM0 1fA0 1cM0 1cM0 1cM0 S00 1HA0 Nc0 1C00 Dc0 1Nc0 Ao0 1h5A0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Gibraltar|GMT BST BDST CET CEST|0 -10 -20 -10 -20|010101010101010101010101010101010101010101010101012121212121010121010101010101010101034343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-2axa0 Rc0 1fA0 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 2Rz0 Dc0 1zc0 Oo0 1zc0 Rc0 1wo0 17c0 1iM0 FA0 xB0 1fA0 1a00 14o0 bb0 LA0 xB0 Rc0 1wo0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 10Jz0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|30e3",
		"Europe/Helsinki|HMT EET EEST|-1D.N -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1WuND.N OULD.N 1dA0 1xGq0 1cM0 1cM0 1cM0 1cN0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Kaliningrad|CET CEST CET CEST MSK MSD EEST EET +03|-10 -20 -20 -30 -30 -40 -30 -20 -30|0101010101010232454545454545454546767676767676767676767676767676767676767676787|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 Am0 Lb0 1en0 op0 1pNz0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|44e4",
		"Europe/Kiev|KMT EET MSK CEST CET MSD EEST|-22.4 -20 -30 -20 -10 -40 -30|0123434252525252525252525256161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161|-1Pc22.4 eUo2.4 rnz0 2Hg0 WM0 1fA0 da0 1v4m0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 Db0 3220 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|34e5",
		"Europe/Kirov|LMT +03 +04 +05|-3i.M -30 -40 -50|01232323232323232321212121212121212121212121212121212121212121|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|48e4",
		"Europe/Lisbon|LMT WET WEST WEMT CET CEST|A.J 0 -10 -20 -10 -20|012121212121212121212121212121212121212121212321232123212321212121212121212121212121212121212121214121212121212121212121212121212124545454212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2le00 aPX0 Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 pvy0 1cM0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|27e5",
		"Europe/Luxembourg|LMT CET CEST WET WEST WEST WET|-o.A -10 -20 0 -10 -20 -10|0121212134343434343434343434343434343434343434343434565651212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2DG0o.A t6mo.A TB0 1nX0 Up0 1o20 11A0 rW0 CM0 1qP0 R90 1EO0 UK0 1u20 10m0 1ip0 1in0 17e0 19W0 1fB0 1db0 1cp0 1in0 17d0 1fz0 1a10 1in0 1a10 1in0 17f0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 vA0 60L0 WM0 1fA0 1cM0 17c0 1io0 16M0 1C00 Uo0 1eeo0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Europe/Madrid|WET WEST WEMT CET CEST|0 -10 -20 -10 -20|010101010101010101210343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-25Td0 19B0 1cL0 1dd0 b1z0 18p0 3HX0 17d0 1fz0 1a10 1io0 1a00 1in0 17d0 iIn0 Hd0 1cL0 bb0 1200 2s20 14n0 5aL0 Mp0 1vz0 17d0 1in0 17d0 1in0 17d0 1in0 17d0 6hX0 11B0 XHX0 1a10 1fz0 1a10 19X0 1cN0 1fz0 1a10 1fC0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|62e5",
		"Europe/Malta|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2arB0 Lz0 1cN0 1db0 1410 1on0 Wp0 1qL0 17d0 1cL0 M3B0 5M20 WM0 1fA0 1co0 17c0 1iM0 16m0 1de0 1lc0 14m0 1lc0 WO0 1qM0 GTW0 On0 1C10 LA0 1C00 LA0 1EM0 LA0 1C00 LA0 1zc0 Oo0 1C00 Oo0 1co0 1cM0 1lA0 Xc0 1qq0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1iN0 19z0 1fB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|42e4",
		"Europe/Minsk|MMT EET MSK CEST CET MSD EEST +03|-1O -20 -30 -20 -10 -40 -30 -30|01234343252525252525252525261616161616161616161616161616161616161617|-1Pc1O eUnO qNX0 3gQ0 WM0 1fA0 1cM0 Al0 1tsn0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 3Fc0 1cN0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0|19e5",
		"Europe/Monaco|PMT WET WEST WEMT CET CEST|-9.l 0 -10 -20 -10 -20|01212121212121212121212121212121212121212121212121232323232345454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-2nco9.l cNb9.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 1u00 10o0 1io0 1wo0 Rc0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Df0 2RV0 11z0 11B0 1ze0 WM0 1fA0 1cM0 1fa0 1aq0 16M0 1ekn0 1cL0 1fC0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|38e3",
		"Europe/Moscow|MMT MMT MST MDST MSD MSK +05 EET EEST MSK|-2u.h -2v.j -3v.j -4v.j -40 -30 -50 -20 -30 -40|012132345464575454545454545454545458754545454545454545454545454545454545454595|-2ag2u.h 2pyW.W 1bA0 11X0 GN0 1Hb0 c4v.j ik0 3DA0 dz0 15A0 c10 2q10 iM10 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|16e6",
		"Europe/Paris|PMT WET WEST CEST CET WEMT|-9.l 0 -10 -20 -10 -20|0121212121212121212121212121212121212121212121212123434352543434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434|-2nco8.l cNb8.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 1u00 10o0 1io0 1wo0 Rc0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Df0 Ik0 5M30 WM0 1fA0 1cM0 Vx0 hB0 1aq0 16M0 1ekn0 1cL0 1fC0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|11e6",
		"Europe/Riga|RMT LST EET MSK CEST CET MSD EEST|-1A.y -2A.y -20 -30 -20 -10 -40 -30|010102345454536363636363636363727272727272727272727272727272727272727272727272727272727272727272727272727272727272727272727272|-25TzA.y 11A0 1iM0 ko0 gWm0 yDXA.y 2bX0 3fE0 WM0 1fA0 1cM0 1cM0 4m0 1sLy0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 1o00 11A0 1o00 11A0 1qM0 3oo0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|64e4",
		"Europe/Rome|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2arB0 Lz0 1cN0 1db0 1410 1on0 Wp0 1qL0 17d0 1cL0 M3B0 5M20 WM0 1fA0 1cM0 16M0 1iM0 16m0 1de0 1lc0 14m0 1lc0 WO0 1qM0 GTW0 On0 1C10 LA0 1C00 LA0 1EM0 LA0 1C00 LA0 1zc0 Oo0 1C00 Oo0 1C00 LA0 1zc0 Oo0 1C00 LA0 1C00 LA0 1zc0 Oo0 1C00 Oo0 1zc0 Oo0 1fC0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|39e5",
		"Europe/Samara|LMT +03 +04 +05|-3k.k -30 -40 -50|0123232323232323232121232323232323232323232323232323232323212|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 2y10 14m0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|12e5",
		"Europe/Saratov|LMT +03 +04 +05|-34.i -30 -40 -50|012323232323232321212121212121212121212121212121212121212121212|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1cM0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 5810",
		"Europe/Simferopol|SMT EET MSK CEST CET MSD EEST MSK|-2g -20 -30 -20 -10 -40 -30 -40|012343432525252525252525252161616525252616161616161616161616161616161616172|-1Pc2g eUog rEn0 2qs0 WM0 1fA0 1cM0 3V0 1u0L0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Q00 4eL0 1cL0 1cN0 1cL0 1cN0 dX0 WL0 1cN0 1cL0 1fB0 1o30 11B0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11z0 1nW0|33e4",
		"Europe/Sofia|EET CET CEST EEST|-20 -10 -20 -30|01212103030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030|-168L0 WM0 1fA0 1cM0 1cM0 1cN0 1mKH0 1dd0 1fb0 1ap0 1fb0 1a20 1fy0 1a30 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1nX0 11E0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Stockholm|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2azC0 TB0 2yDe0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|15e5",
		"Europe/Tallinn|TMT CET CEST EET MSK MSD EEST|-1D -10 -20 -20 -30 -40 -30|012103421212454545454545454546363636363636363636363636363636363636363636363636363636363636363636363636363636363636363636363|-26oND teD 11A0 1Ta0 4rXl KSLD 2FX0 2Jg0 WM0 1fA0 1cM0 18J0 1sTX0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o10 11A0 1qM0 5QM0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|41e4",
		"Europe/Tirane|LMT CET CEST|-1j.k -10 -20|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2glBj.k 14pcj.k 5LC0 WM0 4M0 1fCK0 10n0 1op0 11z0 1pd0 11z0 1qN0 WL0 1qp0 Xb0 1qp0 Xb0 1qp0 11z0 1lB0 11z0 1qN0 11z0 1iN0 16n0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|42e4",
		"Europe/Ulyanovsk|LMT +03 +04 +05 +02|-3d.A -30 -40 -50 -20|01232323232323232321214121212121212121212121212121212121212121212|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0|13e5",
		"Europe/Uzhgorod|CET CEST MSK MSD EET EEST|-10 -20 -30 -40 -20 -30|010101023232323232323232320454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-1cqL0 6i00 WM0 1fA0 1cM0 1ml0 1Cp0 1r3W0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Q00 1Nf0 2pw0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|11e4",
		"Europe/Vienna|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 3KM0 14o0 LA00 6i00 WM0 1fA0 1cM0 1cM0 1cM0 400 2qM0 1a00 1cM0 1cM0 1io0 17c0 1gHa0 19X0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|18e5",
		"Europe/Vilnius|WMT KMT CET EET MSK CEST MSD EEST|-1o -1z.A -10 -20 -30 -20 -40 -30|012324525254646464646464646473737373737373737352537373737373737373737373737373737373737373737373737373737373737373737373|-293do 6ILM.o 1Ooz.A zz0 Mfd0 29W0 3is0 WM0 1fA0 1cM0 LV0 1tgL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11B0 1o00 11A0 1qM0 8io0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Europe/Volgograd|LMT +03 +04 +05|-2V.E -30 -40 -50|012323232323232321212121212121212121212121212121212121212121212|-21IqV.E psLV.E 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1cM0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 9Jd0|10e5",
		"Europe/Warsaw|WMT CET CEST EET EEST|-1o -10 -20 -20 -30|012121234312121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ctdo 1LXo 11d0 1iO0 11A0 1o00 11A0 1on0 11A0 6zy0 HWP0 5IM0 WM0 1fA0 1cM0 1dz0 1mL0 1en0 15B0 1aq0 1nA0 11A0 1io0 17c0 1fA0 1a00 iDX0 LA0 1cM0 1cM0 1C00 Oo0 1cM0 1cM0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1C00 LA0 uso0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e5",
		"Europe/Zaporozhye|+0220 EET MSK CEST CET MSD EEST|-2k -20 -30 -20 -10 -40 -30|01234342525252525252525252526161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161|-1Pc2k eUok rdb0 2RE0 WM0 1fA0 8m0 1v9a0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cK0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|77e4",
		"HST|HST|a0|0|",
		"Indian/Chagos|LMT +05 +06|-4N.E -50 -60|012|-2xosN.E 3AGLN.E|30e2",
		"Indian/Cocos|+0630|-6u|0||596",
		"Indian/Kerguelen|-00 +05|0 -50|01|-MG00|130",
		"Indian/Mahe|LMT +04|-3F.M -40|01|-2yO3F.M|79e3",
		"Indian/Maldives|MMT +05|-4S -50|01|-olgS|35e4",
		"Indian/Mauritius|LMT +04 +05|-3O -40 -50|012121|-2xorO 34unO 14L0 12kr0 11z0|15e4",
		"Indian/Reunion|LMT +04|-3F.Q -40|01|-2mDDF.Q|84e4",
		"Pacific/Kwajalein|+11 +10 +09 -12 +12|-b0 -a0 -90 c0 -c0|012034|-1kln0 akp0 6Up0 12ry0 Wan0|14e3",
		"MET|MET MEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"MST|MST|70|0|",
		"MST7MDT|MST MDT MWT MPT|70 60 60 60|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Pacific/Chatham|+1215 +1245 +1345|-cf -cJ -dJ|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-WqAf 1adef IM0 1C00 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1qM0 14o0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1io0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|600",
		"Pacific/Apia|LMT -1130 -11 -10 +14 +13|bq.U bu b0 a0 -e0 -d0|01232345454545454545454545454545454545454545454545454545454|-2nDMx.4 1yW03.4 2rRbu 1ff0 1a00 CI0 AQ0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|37e3",
		"Pacific/Bougainville|+10 +09 +11|-a0 -90 -b0|0102|-16Wy0 7CN0 2MQp0|18e4",
		"Pacific/Chuuk|+10 +09|-a0 -90|01010|-2ewy0 axB0 RVX0 axd0|49e3",
		"Pacific/Efate|LMT +11 +12|-bd.g -b0 -c0|0121212121212121212121|-2l9nd.g 2Szcd.g 1cL0 1oN0 10L0 1fB0 19X0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 Lz0 1Nd0 An0|66e3",
		"Pacific/Enderbury|-12 -11 +13|c0 b0 -d0|012|nIc0 B7X0|1",
		"Pacific/Fakaofo|-11 +13|b0 -d0|01|1Gfn0|483",
		"Pacific/Fiji|LMT +12 +13|-bT.I -c0 -d0|0121212121212121212121212121212121212121212121212121212121212121|-2bUzT.I 3m8NT.I LA0 1EM0 IM0 nJc0 LA0 1o00 Rc0 1wo0 Ao0 1Nc0 Ao0 1Q00 xz0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0|88e4",
		"Pacific/Galapagos|LMT -05 -06|5W.o 50 60|01212|-1yVS1.A 2dTz1.A gNd0 rz0|25e3",
		"Pacific/Gambier|LMT -09|8X.M 90|01|-2jof0.c|125",
		"Pacific/Guadalcanal|LMT +11|-aD.M -b0|01|-2joyD.M|11e4",
		"Pacific/Guam|GST +09 GDT ChST|-a0 -90 -b0 -a0|01020202020202020203|-18jK0 6pB0 AhB0 3QL0 g2p0 3p91 WOX rX0 1zd0 Rb0 1wp0 Rb0 5xd0 rX0 5sN0 zb1 1C0X On0 ULb0|17e4",
		"Pacific/Honolulu|HST HDT HWT HPT HST|au 9u 9u 9u a0|0102304|-1thLu 8x0 lef0 8wWu iAu 46p0|37e4",
		"Pacific/Kiritimati|-1040 -10 +14|aE a0 -e0|012|nIaE B7Xk|51e2",
		"Pacific/Kosrae|+11 +09 +10 +12|-b0 -90 -a0 -c0|01021030|-2ewz0 axC0 HBy0 akp0 axd0 WOK0 1bdz0|66e2",
		"Pacific/Majuro|+11 +09 +10 +12|-b0 -90 -a0 -c0|0102103|-2ewz0 axC0 HBy0 akp0 6RB0 12um0|28e3",
		"Pacific/Marquesas|LMT -0930|9i 9u|01|-2joeG|86e2",
		"Pacific/Pago_Pago|LMT SST|bm.M b0|01|-2nDMB.c|37e2",
		"Pacific/Nauru|LMT +1130 +09 +12|-b7.E -bu -90 -c0|01213|-1Xdn7.E QCnB.E 7mqu 1lnbu|10e3",
		"Pacific/Niue|-1120 -1130 -11|bk bu b0|012|-KfME 17y0a|12e2",
		"Pacific/Norfolk|+1112 +1130 +1230 +11|-bc -bu -cu -b0|01213|-Kgbc W01G On0 1COp0|25e4",
		"Pacific/Noumea|LMT +11 +12|-b5.M -b0 -c0|01212121|-2l9n5.M 2EqM5.M xX0 1PB0 yn0 HeP0 Ao0|98e3",
		"Pacific/Pitcairn|-0830 -08|8u 80|01|18Vku|56",
		"Pacific/Pohnpei|+11 +09 +10|-b0 -90 -a0|010210|-2ewz0 axC0 HBy0 akp0 axd0|34e3",
		"Pacific/Rarotonga|-1030 -0930 -10|au 9u a0|012121212121212121212121212|lyWu IL0 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu Onu|13e3",
		"Pacific/Tahiti|LMT -10|9W.g a0|01|-2joe1.I|18e4",
		"Pacific/Tongatapu|+1220 +13 +14|-ck -d0 -e0|0121212121|-1aB0k 2n5dk 15A0 1wo0 xz0 1Q10 xz0 zWN0 s00|75e3",
		"PST8PDT|PST PDT PWT PPT|80 70 70 70|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261q0 1nX0 11B0 1nX0 SgN0 8x10 iy0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"WET|WET WEST|0 -10|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|hDB0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00"
	],
	"links": [
		"Africa/Abidjan|Africa/Bamako",
		"Africa/Abidjan|Africa/Banjul",
		"Africa/Abidjan|Africa/Conakry",
		"Africa/Abidjan|Africa/Dakar",
		"Africa/Abidjan|Africa/Freetown",
		"Africa/Abidjan|Africa/Lome",
		"Africa/Abidjan|Africa/Nouakchott",
		"Africa/Abidjan|Africa/Ouagadougou",
		"Africa/Abidjan|Africa/Timbuktu",
		"Africa/Abidjan|Atlantic/St_Helena",
		"Africa/Cairo|Egypt",
		"Africa/Johannesburg|Africa/Maseru",
		"Africa/Johannesburg|Africa/Mbabane",
		"Africa/Lagos|Africa/Bangui",
		"Africa/Lagos|Africa/Brazzaville",
		"Africa/Lagos|Africa/Douala",
		"Africa/Lagos|Africa/Kinshasa",
		"Africa/Lagos|Africa/Libreville",
		"Africa/Lagos|Africa/Luanda",
		"Africa/Lagos|Africa/Malabo",
		"Africa/Lagos|Africa/Niamey",
		"Africa/Lagos|Africa/Porto-Novo",
		"Africa/Maputo|Africa/Blantyre",
		"Africa/Maputo|Africa/Bujumbura",
		"Africa/Maputo|Africa/Gaborone",
		"Africa/Maputo|Africa/Harare",
		"Africa/Maputo|Africa/Kigali",
		"Africa/Maputo|Africa/Lubumbashi",
		"Africa/Maputo|Africa/Lusaka",
		"Africa/Nairobi|Africa/Addis_Ababa",
		"Africa/Nairobi|Africa/Asmara",
		"Africa/Nairobi|Africa/Asmera",
		"Africa/Nairobi|Africa/Dar_es_Salaam",
		"Africa/Nairobi|Africa/Djibouti",
		"Africa/Nairobi|Africa/Kampala",
		"Africa/Nairobi|Africa/Mogadishu",
		"Africa/Nairobi|Indian/Antananarivo",
		"Africa/Nairobi|Indian/Comoro",
		"Africa/Nairobi|Indian/Mayotte",
		"Africa/Tripoli|Libya",
		"America/Adak|America/Atka",
		"America/Adak|US/Aleutian",
		"America/Anchorage|US/Alaska",
		"America/Argentina/Buenos_Aires|America/Buenos_Aires",
		"America/Argentina/Catamarca|America/Argentina/ComodRivadavia",
		"America/Argentina/Catamarca|America/Catamarca",
		"America/Argentina/Cordoba|America/Cordoba",
		"America/Argentina/Cordoba|America/Rosario",
		"America/Argentina/Jujuy|America/Jujuy",
		"America/Argentina/Mendoza|America/Mendoza",
		"America/Atikokan|America/Coral_Harbour",
		"America/Chicago|US/Central",
		"America/Curacao|America/Aruba",
		"America/Curacao|America/Kralendijk",
		"America/Curacao|America/Lower_Princes",
		"America/Denver|America/Shiprock",
		"America/Denver|Navajo",
		"America/Denver|US/Mountain",
		"America/Detroit|US/Michigan",
		"America/Edmonton|Canada/Mountain",
		"America/Fort_Wayne|America/Indiana/Indianapolis",
		"America/Fort_Wayne|America/Indianapolis",
		"America/Fort_Wayne|US/East-Indiana",
		"America/Halifax|Canada/Atlantic",
		"America/Havana|Cuba",
		"America/Indiana/Knox|America/Knox_IN",
		"America/Indiana/Knox|US/Indiana-Starke",
		"America/Jamaica|Jamaica",
		"America/Kentucky/Louisville|America/Louisville",
		"America/Los_Angeles|US/Pacific",
		"America/Los_Angeles|US/Pacific-New",
		"America/Manaus|Brazil/West",
		"America/Mazatlan|Mexico/BajaSur",
		"America/Mexico_City|Mexico/General",
		"America/New_York|US/Eastern",
		"America/Noronha|Brazil/DeNoronha",
		"America/Panama|America/Cayman",
		"America/Phoenix|US/Arizona",
		"America/Port_of_Spain|America/Anguilla",
		"America/Port_of_Spain|America/Antigua",
		"America/Port_of_Spain|America/Dominica",
		"America/Port_of_Spain|America/Grenada",
		"America/Port_of_Spain|America/Guadeloupe",
		"America/Port_of_Spain|America/Marigot",
		"America/Port_of_Spain|America/Montserrat",
		"America/Port_of_Spain|America/St_Barthelemy",
		"America/Port_of_Spain|America/St_Kitts",
		"America/Port_of_Spain|America/St_Lucia",
		"America/Port_of_Spain|America/St_Thomas",
		"America/Port_of_Spain|America/St_Vincent",
		"America/Port_of_Spain|America/Tortola",
		"America/Port_of_Spain|America/Virgin",
		"America/Regina|Canada/Saskatchewan",
		"America/Rio_Branco|America/Porto_Acre",
		"America/Rio_Branco|Brazil/Acre",
		"America/Santiago|Chile/Continental",
		"America/Sao_Paulo|Brazil/East",
		"America/St_Johns|Canada/Newfoundland",
		"America/Tijuana|America/Ensenada",
		"America/Tijuana|America/Santa_Isabel",
		"America/Tijuana|Mexico/BajaNorte",
		"America/Toronto|America/Montreal",
		"America/Toronto|Canada/Eastern",
		"America/Vancouver|Canada/Pacific",
		"America/Whitehorse|Canada/Yukon",
		"America/Winnipeg|Canada/Central",
		"Asia/Ashgabat|Asia/Ashkhabad",
		"Asia/Bangkok|Asia/Phnom_Penh",
		"Asia/Bangkok|Asia/Vientiane",
		"Asia/Dhaka|Asia/Dacca",
		"Asia/Dubai|Asia/Muscat",
		"Asia/Ho_Chi_Minh|Asia/Saigon",
		"Asia/Hong_Kong|Hongkong",
		"Asia/Jerusalem|Asia/Tel_Aviv",
		"Asia/Jerusalem|Israel",
		"Asia/Kathmandu|Asia/Katmandu",
		"Asia/Kolkata|Asia/Calcutta",
		"Asia/Kuala_Lumpur|Asia/Singapore",
		"Asia/Kuala_Lumpur|Singapore",
		"Asia/Macau|Asia/Macao",
		"Asia/Makassar|Asia/Ujung_Pandang",
		"Asia/Nicosia|Europe/Nicosia",
		"Asia/Qatar|Asia/Bahrain",
		"Asia/Rangoon|Asia/Yangon",
		"Asia/Riyadh|Asia/Aden",
		"Asia/Riyadh|Asia/Kuwait",
		"Asia/Seoul|ROK",
		"Asia/Shanghai|Asia/Chongqing",
		"Asia/Shanghai|Asia/Chungking",
		"Asia/Shanghai|Asia/Harbin",
		"Asia/Shanghai|PRC",
		"Asia/Taipei|ROC",
		"Asia/Tehran|Iran",
		"Asia/Thimphu|Asia/Thimbu",
		"Asia/Tokyo|Japan",
		"Asia/Ulaanbaatar|Asia/Ulan_Bator",
		"Asia/Urumqi|Asia/Kashgar",
		"Atlantic/Faroe|Atlantic/Faeroe",
		"Atlantic/Reykjavik|Iceland",
		"Atlantic/South_Georgia|Etc/GMT+2",
		"Australia/Adelaide|Australia/South",
		"Australia/Brisbane|Australia/Queensland",
		"Australia/Broken_Hill|Australia/Yancowinna",
		"Australia/Darwin|Australia/North",
		"Australia/Hobart|Australia/Tasmania",
		"Australia/Lord_Howe|Australia/LHI",
		"Australia/Melbourne|Australia/Victoria",
		"Australia/Perth|Australia/West",
		"Australia/Sydney|Australia/ACT",
		"Australia/Sydney|Australia/Canberra",
		"Australia/Sydney|Australia/NSW",
		"Etc/GMT-0|Etc/GMT",
		"Etc/GMT-0|Etc/GMT+0",
		"Etc/GMT-0|Etc/GMT0",
		"Etc/GMT-0|Etc/Greenwich",
		"Etc/GMT-0|GMT",
		"Etc/GMT-0|GMT+0",
		"Etc/GMT-0|GMT-0",
		"Etc/GMT-0|GMT0",
		"Etc/GMT-0|Greenwich",
		"Etc/UTC|Etc/UCT",
		"Etc/UTC|Etc/Universal",
		"Etc/UTC|Etc/Zulu",
		"Etc/UTC|UCT",
		"Etc/UTC|UTC",
		"Etc/UTC|Universal",
		"Etc/UTC|Zulu",
		"Europe/Belgrade|Europe/Ljubljana",
		"Europe/Belgrade|Europe/Podgorica",
		"Europe/Belgrade|Europe/Sarajevo",
		"Europe/Belgrade|Europe/Skopje",
		"Europe/Belgrade|Europe/Zagreb",
		"Europe/Chisinau|Europe/Tiraspol",
		"Europe/Dublin|Eire",
		"Europe/Helsinki|Europe/Mariehamn",
		"Europe/Istanbul|Asia/Istanbul",
		"Europe/Istanbul|Turkey",
		"Europe/Lisbon|Portugal",
		"Europe/London|Europe/Belfast",
		"Europe/London|Europe/Guernsey",
		"Europe/London|Europe/Isle_of_Man",
		"Europe/London|Europe/Jersey",
		"Europe/London|GB",
		"Europe/London|GB-Eire",
		"Europe/Moscow|W-SU",
		"Europe/Oslo|Arctic/Longyearbyen",
		"Europe/Oslo|Atlantic/Jan_Mayen",
		"Europe/Prague|Europe/Bratislava",
		"Europe/Rome|Europe/San_Marino",
		"Europe/Rome|Europe/Vatican",
		"Europe/Warsaw|Poland",
		"Europe/Zurich|Europe/Busingen",
		"Europe/Zurich|Europe/Vaduz",
		"Indian/Christmas|Etc/GMT-7",
		"Pacific/Auckland|Antarctica/McMurdo",
		"Pacific/Auckland|Antarctica/South_Pole",
		"Pacific/Auckland|NZ",
		"Pacific/Chatham|NZ-CHAT",
		"Pacific/Chuuk|Pacific/Truk",
		"Pacific/Chuuk|Pacific/Yap",
		"Pacific/Easter|Chile/EasterIsland",
		"Pacific/Guam|Pacific/Saipan",
		"Pacific/Honolulu|Pacific/Johnston",
		"Pacific/Honolulu|US/Hawaii",
		"Pacific/Kwajalein|Kwajalein",
		"Pacific/Pago_Pago|Pacific/Midway",
		"Pacific/Pago_Pago|Pacific/Samoa",
		"Pacific/Pago_Pago|US/Samoa",
		"Pacific/Palau|Etc/GMT-9",
		"Pacific/Pohnpei|Pacific/Ponape",
		"Pacific/Port_Moresby|Etc/GMT-10",
		"Pacific/Tarawa|Etc/GMT-12",
		"Pacific/Tarawa|Pacific/Funafuti",
		"Pacific/Tarawa|Pacific/Wake",
		"Pacific/Tarawa|Pacific/Wallis"
	]
}
},{}],52:[function(require,module,exports){
var moment = module.exports = require("./moment-timezone");
moment.tz.load(require('./data/packed/latest.json'));

},{"./data/packed/latest.json":51,"./moment-timezone":53}],53:[function(require,module,exports){
//! moment-timezone.js
//! version : 0.5.26
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.26",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess;

	if (!moment || typeof moment.version !== 'string') {
		logError('Moment Timezone requires Moment.js. See https://momentjs.com/timezone/docs/#/use-it/browser/');
	}

	var momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		if (a.zone.population !== b.zone.population) {
			return b.zone.population - a.zone.population;
		}
		return b.zone.name.localeCompare(a.zone.name);
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {

		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				var z = mom._z;
				mom.utcOffset(-offset, keepTime);
				mom._z = z;
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			if (typeof name !== 'string') {
				throw new Error('Time zone name must be a string, got ' + name + ' [' + typeof name + ']');
			}
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	function resetZoneWrap2 (old) {
		return function () {
			if (arguments.length > 0) this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName  = abbrWrap(fn.zoneName);
	fn.zoneAbbr  = abbrWrap(fn.zoneAbbr);
	fn.utc       = resetZoneWrap(fn.utc);
	fn.local     = resetZoneWrap(fn.local);
	fn.utcOffset = resetZoneWrap2(fn.utcOffset);

	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	// INJECT DATA

	return moment;
}));

},{"moment":54}],54:[function(require,module,exports){
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

    var hookCallback;

    function hooks () {
        return hookCallback.apply(null, arguments);
    }

    // This is done to register the method called with moment()
    // without creating circular dependencies.
    function setHookCallback (callback) {
        hookCallback = callback;
    }

    function isArray(input) {
        return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
    }

    function isObject(input) {
        // IE8 will treat undefined and null as object if it wasn't for
        // input != null
        return input != null && Object.prototype.toString.call(input) === '[object Object]';
    }

    function isObjectEmpty(obj) {
        if (Object.getOwnPropertyNames) {
            return (Object.getOwnPropertyNames(obj).length === 0);
        } else {
            var k;
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    return false;
                }
            }
            return true;
        }
    }

    function isUndefined(input) {
        return input === void 0;
    }

    function isNumber(input) {
        return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
    }

    function isDate(input) {
        return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function hasOwnProp(a, b) {
        return Object.prototype.hasOwnProperty.call(a, b);
    }

    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function createUTC (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, true).utc();
    }

    function defaultParsingFlags() {
        // We need to deep clone this object.
        return {
            empty           : false,
            unusedTokens    : [],
            unusedInput     : [],
            overflow        : -2,
            charsLeftOver   : 0,
            nullInput       : false,
            invalidMonth    : null,
            invalidFormat   : false,
            userInvalidated : false,
            iso             : false,
            parsedDateParts : [],
            meridiem        : null,
            rfc2822         : false,
            weekdayMismatch : false
        };
    }

    function getParsingFlags(m) {
        if (m._pf == null) {
            m._pf = defaultParsingFlags();
        }
        return m._pf;
    }

    var some;
    if (Array.prototype.some) {
        some = Array.prototype.some;
    } else {
        some = function (fun) {
            var t = Object(this);
            var len = t.length >>> 0;

            for (var i = 0; i < len; i++) {
                if (i in t && fun.call(this, t[i], i, t)) {
                    return true;
                }
            }

            return false;
        };
    }

    function isValid(m) {
        if (m._isValid == null) {
            var flags = getParsingFlags(m);
            var parsedParts = some.call(flags.parsedDateParts, function (i) {
                return i != null;
            });
            var isNowValid = !isNaN(m._d.getTime()) &&
                flags.overflow < 0 &&
                !flags.empty &&
                !flags.invalidMonth &&
                !flags.invalidWeekday &&
                !flags.weekdayMismatch &&
                !flags.nullInput &&
                !flags.invalidFormat &&
                !flags.userInvalidated &&
                (!flags.meridiem || (flags.meridiem && parsedParts));

            if (m._strict) {
                isNowValid = isNowValid &&
                    flags.charsLeftOver === 0 &&
                    flags.unusedTokens.length === 0 &&
                    flags.bigHour === undefined;
            }

            if (Object.isFrozen == null || !Object.isFrozen(m)) {
                m._isValid = isNowValid;
            }
            else {
                return isNowValid;
            }
        }
        return m._isValid;
    }

    function createInvalid (flags) {
        var m = createUTC(NaN);
        if (flags != null) {
            extend(getParsingFlags(m), flags);
        }
        else {
            getParsingFlags(m).userInvalidated = true;
        }

        return m;
    }

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    var momentProperties = hooks.momentProperties = [];

    function copyConfig(to, from) {
        var i, prop, val;

        if (!isUndefined(from._isAMomentObject)) {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (!isUndefined(from._i)) {
            to._i = from._i;
        }
        if (!isUndefined(from._f)) {
            to._f = from._f;
        }
        if (!isUndefined(from._l)) {
            to._l = from._l;
        }
        if (!isUndefined(from._strict)) {
            to._strict = from._strict;
        }
        if (!isUndefined(from._tzm)) {
            to._tzm = from._tzm;
        }
        if (!isUndefined(from._isUTC)) {
            to._isUTC = from._isUTC;
        }
        if (!isUndefined(from._offset)) {
            to._offset = from._offset;
        }
        if (!isUndefined(from._pf)) {
            to._pf = getParsingFlags(from);
        }
        if (!isUndefined(from._locale)) {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i = 0; i < momentProperties.length; i++) {
                prop = momentProperties[i];
                val = from[prop];
                if (!isUndefined(val)) {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    var updateInProgress = false;

    // Moment prototype object
    function Moment(config) {
        copyConfig(this, config);
        this._d = new Date(config._d != null ? config._d.getTime() : NaN);
        if (!this.isValid()) {
            this._d = new Date(NaN);
        }
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
        }
    }

    function isMoment (obj) {
        return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
    }

    function absFloor (number) {
        if (number < 0) {
            // -0 -> 0
            return Math.ceil(number) || 0;
        } else {
            return Math.floor(number);
        }
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
        }

        return value;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function warn(msg) {
        if (hooks.suppressDeprecationWarnings === false &&
                (typeof console !==  'undefined') && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;

        return extend(function () {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
                var args = [];
                var arg;
                for (var i = 0; i < arguments.length; i++) {
                    arg = '';
                    if (typeof arguments[i] === 'object') {
                        arg += '\n[' + i + '] ';
                        for (var key in arguments[0]) {
                            arg += key + ': ' + arguments[0][key] + ', ';
                        }
                        arg = arg.slice(0, -2); // Remove trailing comma and space
                    } else {
                        arg = arguments[i];
                    }
                    args.push(arg);
                }
                warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    var deprecations = {};

    function deprecateSimple(name, msg) {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
        }
        if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
        }
    }

    hooks.suppressDeprecationWarnings = false;
    hooks.deprecationHandler = null;

    function isFunction(input) {
        return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
    }

    function set (config) {
        var prop, i;
        for (i in config) {
            prop = config[i];
            if (isFunction(prop)) {
                this[i] = prop;
            } else {
                this['_' + i] = prop;
            }
        }
        this._config = config;
        // Lenient ordinal parsing accepts just a number in addition to
        // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
        // TODO: Remove "ordinalParse" fallback in next major release.
        this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                '|' + (/\d{1,2}/).source);
    }

    function mergeConfigs(parentConfig, childConfig) {
        var res = extend({}, parentConfig), prop;
        for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
                if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                    res[prop] = {};
                    extend(res[prop], parentConfig[prop]);
                    extend(res[prop], childConfig[prop]);
                } else if (childConfig[prop] != null) {
                    res[prop] = childConfig[prop];
                } else {
                    delete res[prop];
                }
            }
        }
        for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])) {
                // make sure changes to properties don't modify parent config
                res[prop] = extend({}, res[prop]);
            }
        }
        return res;
    }

    function Locale(config) {
        if (config != null) {
            this.set(config);
        }
    }

    var keys;

    if (Object.keys) {
        keys = Object.keys;
    } else {
        keys = function (obj) {
            var i, res = [];
            for (i in obj) {
                if (hasOwnProp(obj, i)) {
                    res.push(i);
                }
            }
            return res;
        };
    }

    var defaultCalendar = {
        sameDay : '[Today at] LT',
        nextDay : '[Tomorrow at] LT',
        nextWeek : 'dddd [at] LT',
        lastDay : '[Yesterday at] LT',
        lastWeek : '[Last] dddd [at] LT',
        sameElse : 'L'
    };

    function calendar (key, mom, now) {
        var output = this._calendar[key] || this._calendar['sameElse'];
        return isFunction(output) ? output.call(mom, now) : output;
    }

    var defaultLongDateFormat = {
        LTS  : 'h:mm:ss A',
        LT   : 'h:mm A',
        L    : 'MM/DD/YYYY',
        LL   : 'MMMM D, YYYY',
        LLL  : 'MMMM D, YYYY h:mm A',
        LLLL : 'dddd, MMMM D, YYYY h:mm A'
    };

    function longDateFormat (key) {
        var format = this._longDateFormat[key],
            formatUpper = this._longDateFormat[key.toUpperCase()];

        if (format || !formatUpper) {
            return format;
        }

        this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
            return val.slice(1);
        });

        return this._longDateFormat[key];
    }

    var defaultInvalidDate = 'Invalid date';

    function invalidDate () {
        return this._invalidDate;
    }

    var defaultOrdinal = '%d';
    var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

    function ordinal (number) {
        return this._ordinal.replace('%d', number);
    }

    var defaultRelativeTime = {
        future : 'in %s',
        past   : '%s ago',
        s  : 'a few seconds',
        ss : '%d seconds',
        m  : 'a minute',
        mm : '%d minutes',
        h  : 'an hour',
        hh : '%d hours',
        d  : 'a day',
        dd : '%d days',
        M  : 'a month',
        MM : '%d months',
        y  : 'a year',
        yy : '%d years'
    };

    function relativeTime (number, withoutSuffix, string, isFuture) {
        var output = this._relativeTime[string];
        return (isFunction(output)) ?
            output(number, withoutSuffix, string, isFuture) :
            output.replace(/%d/i, number);
    }

    function pastFuture (diff, output) {
        var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
        return isFunction(format) ? format(output) : format.replace(/%s/i, output);
    }

    var aliases = {};

    function addUnitAlias (unit, shorthand) {
        var lowerCase = unit.toLowerCase();
        aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
    }

    function normalizeUnits(units) {
        return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    var priorities = {};

    function addUnitPriority(unit, priority) {
        priorities[unit] = priority;
    }

    function getPrioritizedUnits(unitsObj) {
        var units = [];
        for (var u in unitsObj) {
            units.push({unit: u, priority: priorities[u]});
        }
        units.sort(function (a, b) {
            return a.priority - b.priority;
        });
        return units;
    }

    function zeroFill(number, targetLength, forceSign) {
        var absNumber = '' + Math.abs(number),
            zerosToFill = targetLength - absNumber.length,
            sign = number >= 0;
        return (sign ? (forceSign ? '+' : '') : '-') +
            Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
    }

    var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

    var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

    var formatFunctions = {};

    var formatTokenFunctions = {};

    // token:    'M'
    // padded:   ['MM', 2]
    // ordinal:  'Mo'
    // callback: function () { this.month() + 1 }
    function addFormatToken (token, padded, ordinal, callback) {
        var func = callback;
        if (typeof callback === 'string') {
            func = function () {
                return this[callback]();
            };
        }
        if (token) {
            formatTokenFunctions[token] = func;
        }
        if (padded) {
            formatTokenFunctions[padded[0]] = function () {
                return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
        }
        if (ordinal) {
            formatTokenFunctions[ordinal] = function () {
                return this.localeData().ordinal(func.apply(this, arguments), token);
            };
        }
    }

    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '', i;
            for (i = 0; i < length; i++) {
                output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());
        formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }

    var match1         = /\d/;            //       0 - 9
    var match2         = /\d\d/;          //      00 - 99
    var match3         = /\d{3}/;         //     000 - 999
    var match4         = /\d{4}/;         //    0000 - 9999
    var match6         = /[+-]?\d{6}/;    // -999999 - 999999
    var match1to2      = /\d\d?/;         //       0 - 99
    var match3to4      = /\d\d\d\d?/;     //     999 - 9999
    var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
    var match1to3      = /\d{1,3}/;       //       0 - 999
    var match1to4      = /\d{1,4}/;       //       0 - 9999
    var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

    var matchUnsigned  = /\d+/;           //       0 - inf
    var matchSigned    = /[+-]?\d+/;      //    -inf - inf

    var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
    var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

    var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

    // any word (or two) characters or numbers including two/three word month in arabic.
    // includes scottish gaelic two word and hyphenated months
    var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

    var regexes = {};

    function addRegexToken (token, regex, strictRegex) {
        regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
            return (isStrict && strictRegex) ? strictRegex : regex;
        };
    }

    function getParseRegexForToken (token, config) {
        if (!hasOwnProp(regexes, token)) {
            return new RegExp(unescapeFormat(token));
        }

        return regexes[token](config._strict, config._locale);
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function unescapeFormat(s) {
        return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        }));
    }

    function regexEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    var tokens = {};

    function addParseToken (token, callback) {
        var i, func = callback;
        if (typeof token === 'string') {
            token = [token];
        }
        if (isNumber(callback)) {
            func = function (input, array) {
                array[callback] = toInt(input);
            };
        }
        for (i = 0; i < token.length; i++) {
            tokens[token[i]] = func;
        }
    }

    function addWeekParseToken (token, callback) {
        addParseToken(token, function (input, array, config, token) {
            config._w = config._w || {};
            callback(input, config._w, config, token);
        });
    }

    function addTimeToArrayFromToken(token, input, config) {
        if (input != null && hasOwnProp(tokens, token)) {
            tokens[token](input, config._a, config, token);
        }
    }

    var YEAR = 0;
    var MONTH = 1;
    var DATE = 2;
    var HOUR = 3;
    var MINUTE = 4;
    var SECOND = 5;
    var MILLISECOND = 6;
    var WEEK = 7;
    var WEEKDAY = 8;

    // FORMATTING

    addFormatToken('Y', 0, 0, function () {
        var y = this.year();
        return y <= 9999 ? '' + y : '+' + y;
    });

    addFormatToken(0, ['YY', 2], 0, function () {
        return this.year() % 100;
    });

    addFormatToken(0, ['YYYY',   4],       0, 'year');
    addFormatToken(0, ['YYYYY',  5],       0, 'year');
    addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

    // ALIASES

    addUnitAlias('year', 'y');

    // PRIORITIES

    addUnitPriority('year', 1);

    // PARSING

    addRegexToken('Y',      matchSigned);
    addRegexToken('YY',     match1to2, match2);
    addRegexToken('YYYY',   match1to4, match4);
    addRegexToken('YYYYY',  match1to6, match6);
    addRegexToken('YYYYYY', match1to6, match6);

    addParseToken(['YYYYY', 'YYYYYY'], YEAR);
    addParseToken('YYYY', function (input, array) {
        array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
    });
    addParseToken('YY', function (input, array) {
        array[YEAR] = hooks.parseTwoDigitYear(input);
    });
    addParseToken('Y', function (input, array) {
        array[YEAR] = parseInt(input, 10);
    });

    // HELPERS

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    // HOOKS

    hooks.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    // MOMENTS

    var getSetYear = makeGetSet('FullYear', true);

    function getIsLeapYear () {
        return isLeapYear(this.year());
    }

    function makeGetSet (unit, keepTime) {
        return function (value) {
            if (value != null) {
                set$1(this, unit, value);
                hooks.updateOffset(this, keepTime);
                return this;
            } else {
                return get(this, unit);
            }
        };
    }

    function get (mom, unit) {
        return mom.isValid() ?
            mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
    }

    function set$1 (mom, unit, value) {
        if (mom.isValid() && !isNaN(value)) {
            if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
            }
            else {
                mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
            }
        }
    }

    // MOMENTS

    function stringGet (units) {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units]();
        }
        return this;
    }


    function stringSet (units, value) {
        if (typeof units === 'object') {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units);
            for (var i = 0; i < prioritized.length; i++) {
                this[prioritized[i].unit](units[prioritized[i].unit]);
            }
        } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units](value);
            }
        }
        return this;
    }

    function mod(n, x) {
        return ((n % x) + x) % x;
    }

    var indexOf;

    if (Array.prototype.indexOf) {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function (o) {
            // I know
            var i;
            for (i = 0; i < this.length; ++i) {
                if (this[i] === o) {
                    return i;
                }
            }
            return -1;
        };
    }

    function daysInMonth(year, month) {
        if (isNaN(year) || isNaN(month)) {
            return NaN;
        }
        var modMonth = mod(month, 12);
        year += (month - modMonth) / 12;
        return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
    }

    // FORMATTING

    addFormatToken('M', ['MM', 2], 'Mo', function () {
        return this.month() + 1;
    });

    addFormatToken('MMM', 0, 0, function (format) {
        return this.localeData().monthsShort(this, format);
    });

    addFormatToken('MMMM', 0, 0, function (format) {
        return this.localeData().months(this, format);
    });

    // ALIASES

    addUnitAlias('month', 'M');

    // PRIORITY

    addUnitPriority('month', 8);

    // PARSING

    addRegexToken('M',    match1to2);
    addRegexToken('MM',   match1to2, match2);
    addRegexToken('MMM',  function (isStrict, locale) {
        return locale.monthsShortRegex(isStrict);
    });
    addRegexToken('MMMM', function (isStrict, locale) {
        return locale.monthsRegex(isStrict);
    });

    addParseToken(['M', 'MM'], function (input, array) {
        array[MONTH] = toInt(input) - 1;
    });

    addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
        var month = config._locale.monthsParse(input, token, config._strict);
        // if we didn't find a month name, mark the date as invalid.
        if (month != null) {
            array[MONTH] = month;
        } else {
            getParsingFlags(config).invalidMonth = input;
        }
    });

    // LOCALES

    var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
    var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
    function localeMonths (m, format) {
        if (!m) {
            return isArray(this._months) ? this._months :
                this._months['standalone'];
        }
        return isArray(this._months) ? this._months[m.month()] :
            this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
    }

    var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
    function localeMonthsShort (m, format) {
        if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort :
                this._monthsShort['standalone'];
        }
        return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
            this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
    }

    function handleStrictParse(monthName, format, strict) {
        var i, ii, mom, llc = monthName.toLocaleLowerCase();
        if (!this._monthsParse) {
            // this is not used
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
                mom = createUTC([2000, i]);
                this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
                this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'MMM') {
                ii = indexOf.call(this._shortMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._longMonthsParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._longMonthsParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortMonthsParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeMonthsParse (monthName, format, strict) {
        var i, mom, regex;

        if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format, strict);
        }

        if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
        }

        // TODO: add sorting
        // Sorting makes sure if one month (or abbr) is a prefix of another
        // see sorting in computeMonthsParse
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            if (strict && !this._longMonthsParse[i]) {
                this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
            }
            if (!strict && !this._monthsParse[i]) {
                regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                return i;
            } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function setMonth (mom, value) {
        var dayOfMonth;

        if (!mom.isValid()) {
            // No op
            return mom;
        }

        if (typeof value === 'string') {
            if (/^\d+$/.test(value)) {
                value = toInt(value);
            } else {
                value = mom.localeData().monthsParse(value);
                // TODO: Another silent failure?
                if (!isNumber(value)) {
                    return mom;
                }
            }
        }

        dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function getSetMonth (value) {
        if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
        } else {
            return get(this, 'Month');
        }
    }

    function getDaysInMonth () {
        return daysInMonth(this.year(), this.month());
    }

    var defaultMonthsShortRegex = matchWord;
    function monthsShortRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsShortStrictRegex;
            } else {
                return this._monthsShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsShortRegex')) {
                this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ?
                this._monthsShortStrictRegex : this._monthsShortRegex;
        }
    }

    var defaultMonthsRegex = matchWord;
    function monthsRegex (isStrict) {
        if (this._monthsParseExact) {
            if (!hasOwnProp(this, '_monthsRegex')) {
                computeMonthsParse.call(this);
            }
            if (isStrict) {
                return this._monthsStrictRegex;
            } else {
                return this._monthsRegex;
            }
        } else {
            if (!hasOwnProp(this, '_monthsRegex')) {
                this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ?
                this._monthsStrictRegex : this._monthsRegex;
        }
    }

    function computeMonthsParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom;
        for (i = 0; i < 12; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, i]);
            shortPieces.push(this.monthsShort(mom, ''));
            longPieces.push(this.months(mom, ''));
            mixedPieces.push(this.months(mom, ''));
            mixedPieces.push(this.monthsShort(mom, ''));
        }
        // Sorting makes sure if one month (or abbr) is a prefix of another it
        // will match the longer piece.
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 12; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
        }
        for (i = 0; i < 24; i++) {
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._monthsShortRegex = this._monthsRegex;
        this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    }

    function createDate (y, m, d, h, M, s, ms) {
        // can't just apply() to create a date:
        // https://stackoverflow.com/q/181348
        var date;
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
                date.setFullYear(y);
            }
        } else {
            date = new Date(y, m, d, h, M, s, ms);
        }

        return date;
    }

    function createUTCDate (y) {
        var date;
        // the Date.UTC function remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            var args = Array.prototype.slice.call(arguments);
            // preserve leap years using a full 400 year cycle, then reset
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
                date.setUTCFullYear(y);
            }
        } else {
            date = new Date(Date.UTC.apply(null, arguments));
        }

        return date;
    }

    // start-of-first-week - start-of-year
    function firstWeekOffset(year, dow, doy) {
        var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
            fwd = 7 + dow - doy,
            // first-week day local weekday -- which local weekday is fwd
            fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

        return -fwdlw + fwd - 1;
    }

    // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
        var localWeekday = (7 + weekday - dow) % 7,
            weekOffset = firstWeekOffset(year, dow, doy),
            dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
            resYear, resDayOfYear;

        if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
        } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
        } else {
            resYear = year;
            resDayOfYear = dayOfYear;
        }

        return {
            year: resYear,
            dayOfYear: resDayOfYear
        };
    }

    function weekOfYear(mom, dow, doy) {
        var weekOffset = firstWeekOffset(mom.year(), dow, doy),
            week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
            resWeek, resYear;

        if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
        } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
        } else {
            resYear = mom.year();
            resWeek = week;
        }

        return {
            week: resWeek,
            year: resYear
        };
    }

    function weeksInYear(year, dow, doy) {
        var weekOffset = firstWeekOffset(year, dow, doy),
            weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
        return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
    }

    // FORMATTING

    addFormatToken('w', ['ww', 2], 'wo', 'week');
    addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

    // ALIASES

    addUnitAlias('week', 'w');
    addUnitAlias('isoWeek', 'W');

    // PRIORITIES

    addUnitPriority('week', 5);
    addUnitPriority('isoWeek', 5);

    // PARSING

    addRegexToken('w',  match1to2);
    addRegexToken('ww', match1to2, match2);
    addRegexToken('W',  match1to2);
    addRegexToken('WW', match1to2, match2);

    addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
        week[token.substr(0, 1)] = toInt(input);
    });

    // HELPERS

    // LOCALES

    function localeWeek (mom) {
        return weekOfYear(mom, this._week.dow, this._week.doy).week;
    }

    var defaultLocaleWeek = {
        dow : 0, // Sunday is the first day of the week.
        doy : 6  // The week that contains Jan 6th is the first week of the year.
    };

    function localeFirstDayOfWeek () {
        return this._week.dow;
    }

    function localeFirstDayOfYear () {
        return this._week.doy;
    }

    // MOMENTS

    function getSetWeek (input) {
        var week = this.localeData().week(this);
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    function getSetISOWeek (input) {
        var week = weekOfYear(this, 1, 4).week;
        return input == null ? week : this.add((input - week) * 7, 'd');
    }

    // FORMATTING

    addFormatToken('d', 0, 'do', 'day');

    addFormatToken('dd', 0, 0, function (format) {
        return this.localeData().weekdaysMin(this, format);
    });

    addFormatToken('ddd', 0, 0, function (format) {
        return this.localeData().weekdaysShort(this, format);
    });

    addFormatToken('dddd', 0, 0, function (format) {
        return this.localeData().weekdays(this, format);
    });

    addFormatToken('e', 0, 0, 'weekday');
    addFormatToken('E', 0, 0, 'isoWeekday');

    // ALIASES

    addUnitAlias('day', 'd');
    addUnitAlias('weekday', 'e');
    addUnitAlias('isoWeekday', 'E');

    // PRIORITY
    addUnitPriority('day', 11);
    addUnitPriority('weekday', 11);
    addUnitPriority('isoWeekday', 11);

    // PARSING

    addRegexToken('d',    match1to2);
    addRegexToken('e',    match1to2);
    addRegexToken('E',    match1to2);
    addRegexToken('dd',   function (isStrict, locale) {
        return locale.weekdaysMinRegex(isStrict);
    });
    addRegexToken('ddd',   function (isStrict, locale) {
        return locale.weekdaysShortRegex(isStrict);
    });
    addRegexToken('dddd',   function (isStrict, locale) {
        return locale.weekdaysRegex(isStrict);
    });

    addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
        var weekday = config._locale.weekdaysParse(input, token, config._strict);
        // if we didn't get a weekday name, mark the date as invalid
        if (weekday != null) {
            week.d = weekday;
        } else {
            getParsingFlags(config).invalidWeekday = input;
        }
    });

    addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
        week[token] = toInt(input);
    });

    // HELPERS

    function parseWeekday(input, locale) {
        if (typeof input !== 'string') {
            return input;
        }

        if (!isNaN(input)) {
            return parseInt(input, 10);
        }

        input = locale.weekdaysParse(input);
        if (typeof input === 'number') {
            return input;
        }

        return null;
    }

    function parseIsoWeekday(input, locale) {
        if (typeof input === 'string') {
            return locale.weekdaysParse(input) % 7 || 7;
        }
        return isNaN(input) ? null : input;
    }

    // LOCALES
    function shiftWeekdays (ws, n) {
        return ws.slice(n, 7).concat(ws.slice(0, n));
    }

    var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
    function localeWeekdays (m, format) {
        var weekdays = isArray(this._weekdays) ? this._weekdays :
            this._weekdays[(m && m !== true && this._weekdays.isFormat.test(format)) ? 'format' : 'standalone'];
        return (m === true) ? shiftWeekdays(weekdays, this._week.dow)
            : (m) ? weekdays[m.day()] : weekdays;
    }

    var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
    function localeWeekdaysShort (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysShort, this._week.dow)
            : (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
    }

    var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
    function localeWeekdaysMin (m) {
        return (m === true) ? shiftWeekdays(this._weekdaysMin, this._week.dow)
            : (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
    }

    function handleStrictParse$1(weekdayName, format, strict) {
        var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];

            for (i = 0; i < 7; ++i) {
                mom = createUTC([2000, 1]).day(i);
                this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
                this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
                this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
            }
        }

        if (strict) {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        } else {
            if (format === 'dddd') {
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else if (format === 'ddd') {
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._minWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            } else {
                ii = indexOf.call(this._minWeekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._weekdaysParse, llc);
                if (ii !== -1) {
                    return ii;
                }
                ii = indexOf.call(this._shortWeekdaysParse, llc);
                return ii !== -1 ? ii : null;
            }
        }
    }

    function localeWeekdaysParse (weekdayName, format, strict) {
        var i, mom, regex;

        if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format, strict);
        }

        if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
        }

        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already

            mom = createUTC([2000, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
                this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\\.?') + '$', 'i');
                this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$', 'i');
                this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$', 'i');
            }
            if (!this._weekdaysParse[i]) {
                regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
            }
            // test the regex
            if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
                return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                return i;
            }
        }
    }

    // MOMENTS

    function getSetDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
        if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, 'd');
        } else {
            return day;
        }
    }

    function getSetLocaleDayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
        return input == null ? weekday : this.add(input - weekday, 'd');
    }

    function getSetISODayOfWeek (input) {
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }

        // behaves the same as moment#day except
        // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
        // as a setter, sunday should belong to the previous week.

        if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
        } else {
            return this.day() || 7;
        }
    }

    var defaultWeekdaysRegex = matchWord;
    function weekdaysRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysStrictRegex;
            } else {
                return this._weekdaysRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ?
                this._weekdaysStrictRegex : this._weekdaysRegex;
        }
    }

    var defaultWeekdaysShortRegex = matchWord;
    function weekdaysShortRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysShortStrictRegex;
            } else {
                return this._weekdaysShortRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ?
                this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
        }
    }

    var defaultWeekdaysMinRegex = matchWord;
    function weekdaysMinRegex (isStrict) {
        if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, '_weekdaysRegex')) {
                computeWeekdaysParse.call(this);
            }
            if (isStrict) {
                return this._weekdaysMinStrictRegex;
            } else {
                return this._weekdaysMinRegex;
            }
        } else {
            if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ?
                this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
        }
    }


    function computeWeekdaysParse () {
        function cmpLenRev(a, b) {
            return b.length - a.length;
        }

        var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
            i, mom, minp, shortp, longp;
        for (i = 0; i < 7; i++) {
            // make the regex if we don't have it already
            mom = createUTC([2000, 1]).day(i);
            minp = this.weekdaysMin(mom, '');
            shortp = this.weekdaysShort(mom, '');
            longp = this.weekdays(mom, '');
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
        }
        // Sorting makes sure if one weekday (or abbr) is a prefix of another it
        // will match the longer piece.
        minPieces.sort(cmpLenRev);
        shortPieces.sort(cmpLenRev);
        longPieces.sort(cmpLenRev);
        mixedPieces.sort(cmpLenRev);
        for (i = 0; i < 7; i++) {
            shortPieces[i] = regexEscape(shortPieces[i]);
            longPieces[i] = regexEscape(longPieces[i]);
            mixedPieces[i] = regexEscape(mixedPieces[i]);
        }

        this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
        this._weekdaysShortRegex = this._weekdaysRegex;
        this._weekdaysMinRegex = this._weekdaysRegex;

        this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
        this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
        this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
    }

    // FORMATTING

    function hFormat() {
        return this.hours() % 12 || 12;
    }

    function kFormat() {
        return this.hours() || 24;
    }

    addFormatToken('H', ['HH', 2], 0, 'hour');
    addFormatToken('h', ['hh', 2], 0, hFormat);
    addFormatToken('k', ['kk', 2], 0, kFormat);

    addFormatToken('hmm', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
    });

    addFormatToken('hmmss', 0, 0, function () {
        return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    addFormatToken('Hmm', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2);
    });

    addFormatToken('Hmmss', 0, 0, function () {
        return '' + this.hours() + zeroFill(this.minutes(), 2) +
            zeroFill(this.seconds(), 2);
    });

    function meridiem (token, lowercase) {
        addFormatToken(token, 0, 0, function () {
            return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
        });
    }

    meridiem('a', true);
    meridiem('A', false);

    // ALIASES

    addUnitAlias('hour', 'h');

    // PRIORITY
    addUnitPriority('hour', 13);

    // PARSING

    function matchMeridiem (isStrict, locale) {
        return locale._meridiemParse;
    }

    addRegexToken('a',  matchMeridiem);
    addRegexToken('A',  matchMeridiem);
    addRegexToken('H',  match1to2);
    addRegexToken('h',  match1to2);
    addRegexToken('k',  match1to2);
    addRegexToken('HH', match1to2, match2);
    addRegexToken('hh', match1to2, match2);
    addRegexToken('kk', match1to2, match2);

    addRegexToken('hmm', match3to4);
    addRegexToken('hmmss', match5to6);
    addRegexToken('Hmm', match3to4);
    addRegexToken('Hmmss', match5to6);

    addParseToken(['H', 'HH'], HOUR);
    addParseToken(['k', 'kk'], function (input, array, config) {
        var kInput = toInt(input);
        array[HOUR] = kInput === 24 ? 0 : kInput;
    });
    addParseToken(['a', 'A'], function (input, array, config) {
        config._isPm = config._locale.isPM(input);
        config._meridiem = input;
    });
    addParseToken(['h', 'hh'], function (input, array, config) {
        array[HOUR] = toInt(input);
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
        getParsingFlags(config).bigHour = true;
    });
    addParseToken('Hmm', function (input, array, config) {
        var pos = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos));
        array[MINUTE] = toInt(input.substr(pos));
    });
    addParseToken('Hmmss', function (input, array, config) {
        var pos1 = input.length - 4;
        var pos2 = input.length - 2;
        array[HOUR] = toInt(input.substr(0, pos1));
        array[MINUTE] = toInt(input.substr(pos1, 2));
        array[SECOND] = toInt(input.substr(pos2));
    });

    // LOCALES

    function localeIsPM (input) {
        // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
        // Using charAt should be more compatible.
        return ((input + '').toLowerCase().charAt(0) === 'p');
    }

    var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
    function localeMeridiem (hours, minutes, isLower) {
        if (hours > 11) {
            return isLower ? 'pm' : 'PM';
        } else {
            return isLower ? 'am' : 'AM';
        }
    }


    // MOMENTS

    // Setting the hour should keep the time, because the user explicitly
    // specified which hour they want. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    var getSetHour = makeGetSet('Hours', true);

    var baseConfig = {
        calendar: defaultCalendar,
        longDateFormat: defaultLongDateFormat,
        invalidDate: defaultInvalidDate,
        ordinal: defaultOrdinal,
        dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
        relativeTime: defaultRelativeTime,

        months: defaultLocaleMonths,
        monthsShort: defaultLocaleMonthsShort,

        week: defaultLocaleWeek,

        weekdays: defaultLocaleWeekdays,
        weekdaysMin: defaultLocaleWeekdaysMin,
        weekdaysShort: defaultLocaleWeekdaysShort,

        meridiemParse: defaultLocaleMeridiemParse
    };

    // internal storage for locale config files
    var locales = {};
    var localeFamilies = {};
    var globalLocale;

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return globalLocale;
    }

    function loadLocale(name) {
        var oldLocale = null;
        // TODO: Find a better way to register and load all the locales in Node
        if (!locales[name] && (typeof module !== 'undefined') &&
                module && module.exports) {
            try {
                oldLocale = globalLocale._abbr;
                var aliasedRequire = require;
                aliasedRequire('./locale/' + name);
                getSetGlobalLocale(oldLocale);
            } catch (e) {}
        }
        return locales[name];
    }

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    function getSetGlobalLocale (key, values) {
        var data;
        if (key) {
            if (isUndefined(values)) {
                data = getLocale(key);
            }
            else {
                data = defineLocale(key, values);
            }

            if (data) {
                // moment.duration._locale = moment._locale = data;
                globalLocale = data;
            }
            else {
                if ((typeof console !==  'undefined') && console.warn) {
                    //warn user if arguments are passed but the locale could not be set
                    console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
                }
            }
        }

        return globalLocale._abbr;
    }

    function defineLocale (name, config) {
        if (config !== null) {
            var locale, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
                deprecateSimple('defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                        'an existing locale. moment.defineLocale(localeName, ' +
                        'config) should only be used for creating a new locale ' +
                        'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
                parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
                if (locales[config.parentLocale] != null) {
                    parentConfig = locales[config.parentLocale]._config;
                } else {
                    locale = loadLocale(config.parentLocale);
                    if (locale != null) {
                        parentConfig = locale._config;
                    } else {
                        if (!localeFamilies[config.parentLocale]) {
                            localeFamilies[config.parentLocale] = [];
                        }
                        localeFamilies[config.parentLocale].push({
                            name: name,
                            config: config
                        });
                        return null;
                    }
                }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));

            if (localeFamilies[name]) {
                localeFamilies[name].forEach(function (x) {
                    defineLocale(x.name, x.config);
                });
            }

            // backwards compat for now: also set the locale
            // make sure we set the locale AFTER all child locales have been
            // created, so we won't end up with the child locale set.
            getSetGlobalLocale(name);


            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    }

    function updateLocale(name, config) {
        if (config != null) {
            var locale, tmpLocale, parentConfig = baseConfig;
            // MERGE
            tmpLocale = loadLocale(name);
            if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
            }
            config = mergeConfigs(parentConfig, config);
            locale = new Locale(config);
            locale.parentLocale = locales[name];
            locales[name] = locale;

            // backwards compat for now: also set the locale
            getSetGlobalLocale(name);
        } else {
            // pass null for config to unupdate, useful for tests
            if (locales[name] != null) {
                if (locales[name].parentLocale != null) {
                    locales[name] = locales[name].parentLocale;
                } else if (locales[name] != null) {
                    delete locales[name];
                }
            }
        }
        return locales[name];
    }

    // returns locale data
    function getLocale (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return globalLocale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    }

    function listLocales() {
        return keys(locales);
    }

    function checkOverflow (m) {
        var overflow;
        var a = m._a;

        if (a && getParsingFlags(m).overflow === -2) {
            overflow =
                a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
                a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
                a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
                a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
                a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
                a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                overflow = WEEK;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                overflow = WEEKDAY;
            }

            getParsingFlags(m).overflow = overflow;
        }

        return m;
    }

    // Pick the first defined of two or three arguments.
    function defaults(a, b, c) {
        if (a != null) {
            return a;
        }
        if (b != null) {
            return b;
        }
        return c;
    }

    function currentDateArray(config) {
        // hooks is actually the exported moment object
        var nowValue = new Date(hooks.now());
        if (config._useUTC) {
            return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
        }
        return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function configFromArray (config) {
        var i, date, input = [], currentDate, expectedWeekday, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
                getParsingFlags(config)._overflowDayOfYear = true;
            }

            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
        expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }

        // check for mismatching day of week
        if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
                weekdayOverflow = true;
            }
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            var curWeek = weekOfYear(createLocal(), dow, doy);

            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

            // Default to current week.
            week = defaults(w.w, curWeek.week);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < 0 || weekday > 6) {
                    weekdayOverflow = true;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from beginning of week
                weekday = w.e + dow;
                if (w.e < 0 || w.e > 6) {
                    weekdayOverflow = true;
                }
            } else {
                // default to beginning of week
                weekday = dow;
            }
        }
        if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
        } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
        } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
        }
    }

    // iso 8601 regex
    // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
    var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
    var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

    var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

    var isoDates = [
        ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
        ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
        ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
        ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
        ['YYYY-DDD', /\d{4}-\d{3}/],
        ['YYYY-MM', /\d{4}-\d\d/, false],
        ['YYYYYYMMDD', /[+-]\d{10}/],
        ['YYYYMMDD', /\d{8}/],
        // YYYYMM is NOT allowed by the standard
        ['GGGG[W]WWE', /\d{4}W\d{3}/],
        ['GGGG[W]WW', /\d{4}W\d{2}/, false],
        ['YYYYDDD', /\d{7}/]
    ];

    // iso time formats and regexes
    var isoTimes = [
        ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
        ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
        ['HH:mm:ss', /\d\d:\d\d:\d\d/],
        ['HH:mm', /\d\d:\d\d/],
        ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
        ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
        ['HHmmss', /\d\d\d\d\d\d/],
        ['HHmm', /\d\d\d\d/],
        ['HH', /\d\d/]
    ];

    var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

    // date from iso format
    function configFromISO(config) {
        var i, l,
            string = config._i,
            match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
            allowTime, dateFormat, timeFormat, tzFormat;

        if (match) {
            getParsingFlags(config).iso = true;

            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(match[1])) {
                    dateFormat = isoDates[i][0];
                    allowTime = isoDates[i][2] !== false;
                    break;
                }
            }
            if (dateFormat == null) {
                config._isValid = false;
                return;
            }
            if (match[3]) {
                for (i = 0, l = isoTimes.length; i < l; i++) {
                    if (isoTimes[i][1].exec(match[3])) {
                        // match[2] should be 'T' or space
                        timeFormat = (match[2] || ' ') + isoTimes[i][0];
                        break;
                    }
                }
                if (timeFormat == null) {
                    config._isValid = false;
                    return;
                }
            }
            if (!allowTime && timeFormat != null) {
                config._isValid = false;
                return;
            }
            if (match[4]) {
                if (tzRegex.exec(match[4])) {
                    tzFormat = 'Z';
                } else {
                    config._isValid = false;
                    return;
                }
            }
            config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
            configFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
    var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

    function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
        var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
        ];

        if (secondStr) {
            result.push(parseInt(secondStr, 10));
        }

        return result;
    }

    function untruncateYear(yearStr) {
        var year = parseInt(yearStr, 10);
        if (year <= 49) {
            return 2000 + year;
        } else if (year <= 999) {
            return 1900 + year;
        }
        return year;
    }

    function preprocessRFC2822(s) {
        // Remove comments and folding whitespace and replace multiple-spaces with a single space
        return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').replace(/^\s\s*/, '').replace(/\s\s*$/, '');
    }

    function checkWeekday(weekdayStr, parsedInput, config) {
        if (weekdayStr) {
            // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
            if (weekdayProvided !== weekdayActual) {
                getParsingFlags(config).weekdayMismatch = true;
                config._isValid = false;
                return false;
            }
        }
        return true;
    }

    var obsOffsets = {
        UT: 0,
        GMT: 0,
        EDT: -4 * 60,
        EST: -5 * 60,
        CDT: -5 * 60,
        CST: -6 * 60,
        MDT: -6 * 60,
        MST: -7 * 60,
        PDT: -7 * 60,
        PST: -8 * 60
    };

    function calculateOffset(obsOffset, militaryOffset, numOffset) {
        if (obsOffset) {
            return obsOffsets[obsOffset];
        } else if (militaryOffset) {
            // the only allowed military tz is Z
            return 0;
        } else {
            var hm = parseInt(numOffset, 10);
            var m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
        }
    }

    // date and time from ref 2822 format
    function configFromRFC2822(config) {
        var match = rfc2822.exec(preprocessRFC2822(config._i));
        if (match) {
            var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
            if (!checkWeekday(match[1], parsedArray, config)) {
                return;
            }

            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);

            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

            getParsingFlags(config).rfc2822 = true;
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function configFromString(config) {
        var matched = aspNetJsonRegex.exec(config._i);

        if (matched !== null) {
            config._d = new Date(+matched[1]);
            return;
        }

        configFromISO(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        configFromRFC2822(config);
        if (config._isValid === false) {
            delete config._isValid;
        } else {
            return;
        }

        // Final attempt, use Input Fallback
        hooks.createFromInputFallback(config);
    }

    hooks.createFromInputFallback = deprecate(
        'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
        'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
        'discouraged and will be removed in an upcoming major release. Please refer to ' +
        'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // constant that refers to the ISO standard
    hooks.ISO_8601 = function () {};

    // constant that refers to the RFC 2822 form
    hooks.RFC_2822 = function () {};

    // date from string and format string
    function configFromStringAndFormat(config) {
        // TODO: Move this to another part of the creation flow to prevent circular deps
        if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
        }
        if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
        }
        config._a = [];
        getParsingFlags(config).empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            // console.log('token', token, 'parsedInput', parsedInput,
            //         'regex', getParseRegexForToken(token, config));
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    getParsingFlags(config).unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    getParsingFlags(config).empty = false;
                }
                else {
                    getParsingFlags(config).unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                getParsingFlags(config).unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._a[HOUR] <= 12 &&
            getParsingFlags(config).bigHour === true &&
            config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = undefined;
        }

        getParsingFlags(config).parsedDateParts = config._a.slice(0);
        getParsingFlags(config).meridiem = config._meridiem;
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

        configFromArray(config);
        checkOverflow(config);
    }


    function meridiemFixWrap (locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // this is not supposed to happen
            return hour;
        }
    }

    // date from string and array of format strings
    function configFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += getParsingFlags(tempConfig).charsLeftOver;

            //or tokens
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

            getParsingFlags(tempConfig).score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    function configFromObject(config) {
        if (config._d) {
            return;
        }

        var i = normalizeObjectUnits(config._i);
        config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
            return obj && parseInt(obj, 10);
        });

        configFromArray(config);
    }

    function createFromConfig (config) {
        var res = new Moment(checkOverflow(prepareConfig(config)));
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    function prepareConfig (config) {
        var input = config._i,
            format = config._f;

        config._locale = config._locale || getLocale(config._l);

        if (input === null || (format === undefined && input === '')) {
            return createInvalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (isMoment(input)) {
            return new Moment(checkOverflow(input));
        } else if (isDate(input)) {
            config._d = input;
        } else if (isArray(format)) {
            configFromStringAndArray(config);
        } else if (format) {
            configFromStringAndFormat(config);
        }  else {
            configFromInput(config);
        }

        if (!isValid(config)) {
            config._d = null;
        }

        return config;
    }

    function configFromInput(config) {
        var input = config._i;
        if (isUndefined(input)) {
            config._d = new Date(hooks.now());
        } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
        } else if (typeof input === 'string') {
            configFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            configFromArray(config);
        } else if (isObject(input)) {
            configFromObject(config);
        } else if (isNumber(input)) {
            // from milliseconds
            config._d = new Date(input);
        } else {
            hooks.createFromInputFallback(config);
        }
    }

    function createLocalOrUTC (input, format, locale, strict, isUTC) {
        var c = {};

        if (locale === true || locale === false) {
            strict = locale;
            locale = undefined;
        }

        if ((isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)) {
            input = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c._isAMomentObject = true;
        c._useUTC = c._isUTC = isUTC;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;

        return createFromConfig(c);
    }

    function createLocal (input, format, locale, strict) {
        return createLocalOrUTC(input, format, locale, strict, false);
    }

    var prototypeMin = deprecate(
        'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other < this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    var prototypeMax = deprecate(
        'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
        function () {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
                return other > this ? this : other;
            } else {
                return createInvalid();
            }
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return createLocal();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    // TODO: Use [].sort instead?
    function min () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    }

    function max () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    }

    var now = function () {
        return Date.now ? Date.now() : +(new Date());
    };

    var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

    function isDurationValid(m) {
        for (var key in m) {
            if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
                return false;
            }
        }

        var unitHasDecimal = false;
        for (var i = 0; i < ordering.length; ++i) {
            if (m[ordering[i]]) {
                if (unitHasDecimal) {
                    return false; // only allow non-integers for smallest unit
                }
                if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                    unitHasDecimal = true;
                }
            }
        }

        return true;
    }

    function isValid$1() {
        return this._isValid;
    }

    function createInvalid$1() {
        return createDuration(NaN);
    }

    function Duration (duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        this._isValid = isDurationValid(normalizedInput);

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible to translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = getLocale();

        this._bubble();
    }

    function isDuration (obj) {
        return obj instanceof Duration;
    }

    function absRound (number) {
        if (number < 0) {
            return Math.round(-1 * number) * -1;
        } else {
            return Math.round(number);
        }
    }

    // FORMATTING

    function offset (token, separator) {
        addFormatToken(token, 0, 0, function () {
            var offset = this.utcOffset();
            var sign = '+';
            if (offset < 0) {
                offset = -offset;
                sign = '-';
            }
            return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
        });
    }

    offset('Z', ':');
    offset('ZZ', '');

    // PARSING

    addRegexToken('Z',  matchShortOffset);
    addRegexToken('ZZ', matchShortOffset);
    addParseToken(['Z', 'ZZ'], function (input, array, config) {
        config._useUTC = true;
        config._tzm = offsetFromString(matchShortOffset, input);
    });

    // HELPERS

    // timezone chunker
    // '+10:00' > ['10',  '00']
    // '-1530'  > ['-15', '30']
    var chunkOffset = /([\+\-]|\d\d)/gi;

    function offsetFromString(matcher, string) {
        var matches = (string || '').match(matcher);

        if (matches === null) {
            return null;
        }

        var chunk   = matches[matches.length - 1] || [];
        var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
        var minutes = +(parts[1] * 60) + toInt(parts[2]);

        return minutes === 0 ?
          0 :
          parts[0] === '+' ? minutes : -minutes;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function cloneWithOffset(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(res._d.valueOf() + diff);
            hooks.updateOffset(res, false);
            return res;
        } else {
            return createLocal(input).local();
        }
    }

    function getDateOffset (m) {
        // On Firefox.24 Date#getTimezoneOffset returns a floating point.
        // https://github.com/moment/moment/pull/1871
        return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
    }

    // HOOKS

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    hooks.updateOffset = function () {};

    // MOMENTS

    // keepLocalTime = true means only change the timezone, without
    // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
    // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
    // +0200, so we adjust the time as needed, to be valid.
    //
    // Keeping the time actually adds/subtracts (one hour)
    // from the actual represented time. That is why we call updateOffset
    // a second time. In case it wants us to change the offset again
    // _changeInProgress == true case, then we have to adjust, because
    // there is no such time in the given timezone.
    function getSetOffset (input, keepLocalTime, keepMinutes) {
        var offset = this._offset || 0,
            localAdjust;
        if (!this.isValid()) {
            return input != null ? this : NaN;
        }
        if (input != null) {
            if (typeof input === 'string') {
                input = offsetFromString(matchShortOffset, input);
                if (input === null) {
                    return this;
                }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
                input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
                localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
                this.add(localAdjust, 'm');
            }
            if (offset !== input) {
                if (!keepLocalTime || this._changeInProgress) {
                    addSubtract(this, createDuration(input - offset, 'm'), 1, false);
                } else if (!this._changeInProgress) {
                    this._changeInProgress = true;
                    hooks.updateOffset(this, true);
                    this._changeInProgress = null;
                }
            }
            return this;
        } else {
            return this._isUTC ? offset : getDateOffset(this);
        }
    }

    function getSetZone (input, keepLocalTime) {
        if (input != null) {
            if (typeof input !== 'string') {
                input = -input;
            }

            this.utcOffset(input, keepLocalTime);

            return this;
        } else {
            return -this.utcOffset();
        }
    }

    function setOffsetToUTC (keepLocalTime) {
        return this.utcOffset(0, keepLocalTime);
    }

    function setOffsetToLocal (keepLocalTime) {
        if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;

            if (keepLocalTime) {
                this.subtract(getDateOffset(this), 'm');
            }
        }
        return this;
    }

    function setOffsetToParsedOffset () {
        if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
        } else if (typeof this._i === 'string') {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
                this.utcOffset(tZone);
            }
            else {
                this.utcOffset(0, true);
            }
        }
        return this;
    }

    function hasAlignedHourOffset (input) {
        if (!this.isValid()) {
            return false;
        }
        input = input ? createLocal(input).utcOffset() : 0;

        return (this.utcOffset() - input) % 60 === 0;
    }

    function isDaylightSavingTime () {
        return (
            this.utcOffset() > this.clone().month(0).utcOffset() ||
            this.utcOffset() > this.clone().month(5).utcOffset()
        );
    }

    function isDaylightSavingTimeShifted () {
        if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
        }

        var c = {};

        copyConfig(c, this);
        c = prepareConfig(c);

        if (c._a) {
            var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() &&
                compareArrays(c._a, other.toArray()) > 0;
        } else {
            this._isDSTShifted = false;
        }

        return this._isDSTShifted;
    }

    function isLocal () {
        return this.isValid() ? !this._isUTC : false;
    }

    function isUtcOffset () {
        return this.isValid() ? this._isUTC : false;
    }

    function isUtc () {
        return this.isValid() ? this._isUTC && this._offset === 0 : false;
    }

    // ASP.NET json date format regex
    var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

    // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
    // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
    // and further modified to allow for strings containing both week and day
    var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

    function createDuration (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            diffRes;

        if (isDuration(input)) {
            duration = {
                ms : input._milliseconds,
                d  : input._days,
                M  : input._months
            };
        } else if (isNumber(input)) {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y  : 0,
                d  : toInt(match[DATE])                         * sign,
                h  : toInt(match[HOUR])                         * sign,
                m  : toInt(match[MINUTE])                       * sign,
                s  : toInt(match[SECOND])                       * sign,
                ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
            };
        } else if (!!(match = isoRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y : parseIso(match[2], sign),
                M : parseIso(match[3], sign),
                w : parseIso(match[4], sign),
                d : parseIso(match[5], sign),
                h : parseIso(match[6], sign),
                m : parseIso(match[7], sign),
                s : parseIso(match[8], sign)
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    }

    createDuration.fn = Duration.prototype;
    createDuration.invalid = createInvalid$1;

    function parseIso (inp, sign) {
        // We'd normally use ~~inp for this, but unfortunately it also
        // converts floats to ints.
        // inp may be undefined, so careful calling replace on it.
        var res = inp && parseFloat(inp.replace(',', '.'));
        // apply sign while we're at it
        return (isNaN(res) ? 0 : res) * sign;
    }

    function positiveMomentsDifference(base, other) {
        var res = {};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        if (!(base.isValid() && other.isValid())) {
            return {milliseconds: 0, months: 0};
        }

        other = cloneWithOffset(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
                'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
        };
    }

    function addSubtract (mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = absRound(duration._days),
            months = absRound(duration._months);

        if (!mom.isValid()) {
            // No op
            return;
        }

        updateOffset = updateOffset == null ? true : updateOffset;

        if (months) {
            setMonth(mom, get(mom, 'Month') + months * isAdding);
        }
        if (days) {
            set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
        }
        if (milliseconds) {
            mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
        }
        if (updateOffset) {
            hooks.updateOffset(mom, days || months);
        }
    }

    var add      = createAdder(1, 'add');
    var subtract = createAdder(-1, 'subtract');

    function getCalendarFormat(myMoment, now) {
        var diff = myMoment.diff(now, 'days', true);
        return diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
    }

    function calendar$1 (time, formats) {
        // We want to compare the start of today, vs this.
        // Getting start-of-today depends on whether we're local/utc/offset or not.
        var now = time || createLocal(),
            sod = cloneWithOffset(now, this).startOf('day'),
            format = hooks.calendarFormat(this, sod) || 'sameElse';

        var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

        return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
    }

    function clone () {
        return new Moment(this);
    }

    function isAfter (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() > localInput.valueOf();
        } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
        }
    }

    function isBefore (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input);
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() < localInput.valueOf();
        } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
        }
    }

    function isBetween (from, to, units, inclusivity) {
        var localFrom = isMoment(from) ? from : createLocal(from),
            localTo = isMoment(to) ? to : createLocal(to);
        if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
        }
        inclusivity = inclusivity || '()';
        return (inclusivity[0] === '(' ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) &&
            (inclusivity[1] === ')' ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
    }

    function isSame (input, units) {
        var localInput = isMoment(input) ? input : createLocal(input),
            inputMs;
        if (!(this.isValid() && localInput.isValid())) {
            return false;
        }
        units = normalizeUnits(units) || 'millisecond';
        if (units === 'millisecond') {
            return this.valueOf() === localInput.valueOf();
        } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
        }
    }

    function isSameOrAfter (input, units) {
        return this.isSame(input, units) || this.isAfter(input, units);
    }

    function isSameOrBefore (input, units) {
        return this.isSame(input, units) || this.isBefore(input, units);
    }

    function diff (input, units, asFloat) {
        var that,
            zoneDelta,
            output;

        if (!this.isValid()) {
            return NaN;
        }

        that = cloneWithOffset(input, this);

        if (!that.isValid()) {
            return NaN;
        }

        zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

        units = normalizeUnits(units);

        switch (units) {
            case 'year': output = monthDiff(this, that) / 12; break;
            case 'month': output = monthDiff(this, that); break;
            case 'quarter': output = monthDiff(this, that) / 3; break;
            case 'second': output = (this - that) / 1e3; break; // 1000
            case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
            case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
            case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
            case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
            default: output = this - that;
        }

        return asFloat ? output : absFloor(output);
    }

    function monthDiff (a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        //check for negative zero, return zero if negative zero
        return -(wholeMonthDiff + adjust) || 0;
    }

    hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
    hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

    function toString () {
        return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
    }

    function toISOString(keepOffset) {
        if (!this.isValid()) {
            return null;
        }
        var utc = keepOffset !== true;
        var m = utc ? this.clone().utc() : this;
        if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
        }
        if (isFunction(Date.prototype.toISOString)) {
            // native implementation is ~50x faster, use it when we can
            if (utc) {
                return this.toDate().toISOString();
            } else {
                return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
            }
        }
        return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }

    /**
     * Return a human readable representation of a moment that can
     * also be evaluated to get a new moment which is the same
     *
     * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
     */
    function inspect () {
        if (!this.isValid()) {
            return 'moment.invalid(/* ' + this._i + ' */)';
        }
        var func = 'moment';
        var zone = '';
        if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
            zone = 'Z';
        }
        var prefix = '[' + func + '("]';
        var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
        var datetime = '-MM-DD[T]HH:mm:ss.SSS';
        var suffix = zone + '[")]';

        return this.format(prefix + year + datetime + suffix);
    }

    function format (inputString) {
        if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
        }
        var output = formatMoment(this, inputString);
        return this.localeData().postformat(output);
    }

    function from (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function fromNow (withoutSuffix) {
        return this.from(createLocal(), withoutSuffix);
    }

    function to (time, withoutSuffix) {
        if (this.isValid() &&
                ((isMoment(time) && time.isValid()) ||
                 createLocal(time).isValid())) {
            return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
        } else {
            return this.localeData().invalidDate();
        }
    }

    function toNow (withoutSuffix) {
        return this.to(createLocal(), withoutSuffix);
    }

    // If passed a locale key, it will set the locale for this
    // instance.  Otherwise, it will return the locale configuration
    // variables for this instance.
    function locale (key) {
        var newLocaleData;

        if (key === undefined) {
            return this._locale._abbr;
        } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
                this._locale = newLocaleData;
            }
            return this;
        }
    }

    var lang = deprecate(
        'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
        function (key) {
            if (key === undefined) {
                return this.localeData();
            } else {
                return this.locale(key);
            }
        }
    );

    function localeData () {
        return this._locale;
    }

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

    // actual modulo - handles negative numbers (for dates before 1970):
    function mod$1(dividend, divisor) {
        return (dividend % divisor + divisor) % divisor;
    }

    function localStartOfDate(y, m, d) {
        // the date constructor remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return new Date(y, m, d).valueOf();
        }
    }

    function utcStartOfDate(y, m, d) {
        // Date.UTC remaps years 0-99 to 1900-1999
        if (y < 100 && y >= 0) {
            // preserve leap years using a full 400 year cycle, then reset
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
        } else {
            return Date.UTC(y, m, d);
        }
    }

    function startOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year(), 0, 1);
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3, 1);
                break;
            case 'month':
                time = startOfDate(this.year(), this.month(), 1);
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday());
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1));
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date());
                break;
            case 'hour':
                time = this._d.valueOf();
                time -= mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR);
                break;
            case 'minute':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_MINUTE);
                break;
            case 'second':
                time = this._d.valueOf();
                time -= mod$1(time, MS_PER_SECOND);
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function endOf (units) {
        var time;
        units = normalizeUnits(units);
        if (units === undefined || units === 'millisecond' || !this.isValid()) {
            return this;
        }

        var startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

        switch (units) {
            case 'year':
                time = startOfDate(this.year() + 1, 0, 1) - 1;
                break;
            case 'quarter':
                time = startOfDate(this.year(), this.month() - this.month() % 3 + 3, 1) - 1;
                break;
            case 'month':
                time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                break;
            case 'week':
                time = startOfDate(this.year(), this.month(), this.date() - this.weekday() + 7) - 1;
                break;
            case 'isoWeek':
                time = startOfDate(this.year(), this.month(), this.date() - (this.isoWeekday() - 1) + 7) - 1;
                break;
            case 'day':
            case 'date':
                time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                break;
            case 'hour':
                time = this._d.valueOf();
                time += MS_PER_HOUR - mod$1(time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE), MS_PER_HOUR) - 1;
                break;
            case 'minute':
                time = this._d.valueOf();
                time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                break;
            case 'second':
                time = this._d.valueOf();
                time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                break;
        }

        this._d.setTime(time);
        hooks.updateOffset(this, true);
        return this;
    }

    function valueOf () {
        return this._d.valueOf() - ((this._offset || 0) * 60000);
    }

    function unix () {
        return Math.floor(this.valueOf() / 1000);
    }

    function toDate () {
        return new Date(this.valueOf());
    }

    function toArray () {
        var m = this;
        return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
    }

    function toObject () {
        var m = this;
        return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
        };
    }

    function toJSON () {
        // new Date(NaN).toJSON() === null
        return this.isValid() ? this.toISOString() : null;
    }

    function isValid$2 () {
        return isValid(this);
    }

    function parsingFlags () {
        return extend({}, getParsingFlags(this));
    }

    function invalidAt () {
        return getParsingFlags(this).overflow;
    }

    function creationData() {
        return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
        };
    }

    // FORMATTING

    addFormatToken(0, ['gg', 2], 0, function () {
        return this.weekYear() % 100;
    });

    addFormatToken(0, ['GG', 2], 0, function () {
        return this.isoWeekYear() % 100;
    });

    function addWeekYearFormatToken (token, getter) {
        addFormatToken(0, [token, token.length], 0, getter);
    }

    addWeekYearFormatToken('gggg',     'weekYear');
    addWeekYearFormatToken('ggggg',    'weekYear');
    addWeekYearFormatToken('GGGG',  'isoWeekYear');
    addWeekYearFormatToken('GGGGG', 'isoWeekYear');

    // ALIASES

    addUnitAlias('weekYear', 'gg');
    addUnitAlias('isoWeekYear', 'GG');

    // PRIORITY

    addUnitPriority('weekYear', 1);
    addUnitPriority('isoWeekYear', 1);


    // PARSING

    addRegexToken('G',      matchSigned);
    addRegexToken('g',      matchSigned);
    addRegexToken('GG',     match1to2, match2);
    addRegexToken('gg',     match1to2, match2);
    addRegexToken('GGGG',   match1to4, match4);
    addRegexToken('gggg',   match1to4, match4);
    addRegexToken('GGGGG',  match1to6, match6);
    addRegexToken('ggggg',  match1to6, match6);

    addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
        week[token.substr(0, 2)] = toInt(input);
    });

    addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
        week[token] = hooks.parseTwoDigitYear(input);
    });

    // MOMENTS

    function getSetWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy);
    }

    function getSetISOWeekYear (input) {
        return getSetWeekYearHelper.call(this,
                input, this.isoWeek(), this.isoWeekday(), 1, 4);
    }

    function getISOWeeksInYear () {
        return weeksInYear(this.year(), 1, 4);
    }

    function getWeeksInYear () {
        var weekInfo = this.localeData()._week;
        return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
    }

    function getSetWeekYearHelper(input, week, weekday, dow, doy) {
        var weeksTarget;
        if (input == null) {
            return weekOfYear(this, dow, doy).year;
        } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
                week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
        }
    }

    function setWeekAll(weekYear, week, weekday, dow, doy) {
        var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
            date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

        this.year(date.getUTCFullYear());
        this.month(date.getUTCMonth());
        this.date(date.getUTCDate());
        return this;
    }

    // FORMATTING

    addFormatToken('Q', 0, 'Qo', 'quarter');

    // ALIASES

    addUnitAlias('quarter', 'Q');

    // PRIORITY

    addUnitPriority('quarter', 7);

    // PARSING

    addRegexToken('Q', match1);
    addParseToken('Q', function (input, array) {
        array[MONTH] = (toInt(input) - 1) * 3;
    });

    // MOMENTS

    function getSetQuarter (input) {
        return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
    }

    // FORMATTING

    addFormatToken('D', ['DD', 2], 'Do', 'date');

    // ALIASES

    addUnitAlias('date', 'D');

    // PRIORITY
    addUnitPriority('date', 9);

    // PARSING

    addRegexToken('D',  match1to2);
    addRegexToken('DD', match1to2, match2);
    addRegexToken('Do', function (isStrict, locale) {
        // TODO: Remove "ordinalParse" fallback in next major release.
        return isStrict ?
          (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
          locale._dayOfMonthOrdinalParseLenient;
    });

    addParseToken(['D', 'DD'], DATE);
    addParseToken('Do', function (input, array) {
        array[DATE] = toInt(input.match(match1to2)[0]);
    });

    // MOMENTS

    var getSetDayOfMonth = makeGetSet('Date', true);

    // FORMATTING

    addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

    // ALIASES

    addUnitAlias('dayOfYear', 'DDD');

    // PRIORITY
    addUnitPriority('dayOfYear', 4);

    // PARSING

    addRegexToken('DDD',  match1to3);
    addRegexToken('DDDD', match3);
    addParseToken(['DDD', 'DDDD'], function (input, array, config) {
        config._dayOfYear = toInt(input);
    });

    // HELPERS

    // MOMENTS

    function getSetDayOfYear (input) {
        var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
        return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
    }

    // FORMATTING

    addFormatToken('m', ['mm', 2], 0, 'minute');

    // ALIASES

    addUnitAlias('minute', 'm');

    // PRIORITY

    addUnitPriority('minute', 14);

    // PARSING

    addRegexToken('m',  match1to2);
    addRegexToken('mm', match1to2, match2);
    addParseToken(['m', 'mm'], MINUTE);

    // MOMENTS

    var getSetMinute = makeGetSet('Minutes', false);

    // FORMATTING

    addFormatToken('s', ['ss', 2], 0, 'second');

    // ALIASES

    addUnitAlias('second', 's');

    // PRIORITY

    addUnitPriority('second', 15);

    // PARSING

    addRegexToken('s',  match1to2);
    addRegexToken('ss', match1to2, match2);
    addParseToken(['s', 'ss'], SECOND);

    // MOMENTS

    var getSetSecond = makeGetSet('Seconds', false);

    // FORMATTING

    addFormatToken('S', 0, 0, function () {
        return ~~(this.millisecond() / 100);
    });

    addFormatToken(0, ['SS', 2], 0, function () {
        return ~~(this.millisecond() / 10);
    });

    addFormatToken(0, ['SSS', 3], 0, 'millisecond');
    addFormatToken(0, ['SSSS', 4], 0, function () {
        return this.millisecond() * 10;
    });
    addFormatToken(0, ['SSSSS', 5], 0, function () {
        return this.millisecond() * 100;
    });
    addFormatToken(0, ['SSSSSS', 6], 0, function () {
        return this.millisecond() * 1000;
    });
    addFormatToken(0, ['SSSSSSS', 7], 0, function () {
        return this.millisecond() * 10000;
    });
    addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
        return this.millisecond() * 100000;
    });
    addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
        return this.millisecond() * 1000000;
    });


    // ALIASES

    addUnitAlias('millisecond', 'ms');

    // PRIORITY

    addUnitPriority('millisecond', 16);

    // PARSING

    addRegexToken('S',    match1to3, match1);
    addRegexToken('SS',   match1to3, match2);
    addRegexToken('SSS',  match1to3, match3);

    var token;
    for (token = 'SSSS'; token.length <= 9; token += 'S') {
        addRegexToken(token, matchUnsigned);
    }

    function parseMs(input, array) {
        array[MILLISECOND] = toInt(('0.' + input) * 1000);
    }

    for (token = 'S'; token.length <= 9; token += 'S') {
        addParseToken(token, parseMs);
    }
    // MOMENTS

    var getSetMillisecond = makeGetSet('Milliseconds', false);

    // FORMATTING

    addFormatToken('z',  0, 0, 'zoneAbbr');
    addFormatToken('zz', 0, 0, 'zoneName');

    // MOMENTS

    function getZoneAbbr () {
        return this._isUTC ? 'UTC' : '';
    }

    function getZoneName () {
        return this._isUTC ? 'Coordinated Universal Time' : '';
    }

    var proto = Moment.prototype;

    proto.add               = add;
    proto.calendar          = calendar$1;
    proto.clone             = clone;
    proto.diff              = diff;
    proto.endOf             = endOf;
    proto.format            = format;
    proto.from              = from;
    proto.fromNow           = fromNow;
    proto.to                = to;
    proto.toNow             = toNow;
    proto.get               = stringGet;
    proto.invalidAt         = invalidAt;
    proto.isAfter           = isAfter;
    proto.isBefore          = isBefore;
    proto.isBetween         = isBetween;
    proto.isSame            = isSame;
    proto.isSameOrAfter     = isSameOrAfter;
    proto.isSameOrBefore    = isSameOrBefore;
    proto.isValid           = isValid$2;
    proto.lang              = lang;
    proto.locale            = locale;
    proto.localeData        = localeData;
    proto.max               = prototypeMax;
    proto.min               = prototypeMin;
    proto.parsingFlags      = parsingFlags;
    proto.set               = stringSet;
    proto.startOf           = startOf;
    proto.subtract          = subtract;
    proto.toArray           = toArray;
    proto.toObject          = toObject;
    proto.toDate            = toDate;
    proto.toISOString       = toISOString;
    proto.inspect           = inspect;
    proto.toJSON            = toJSON;
    proto.toString          = toString;
    proto.unix              = unix;
    proto.valueOf           = valueOf;
    proto.creationData      = creationData;
    proto.year       = getSetYear;
    proto.isLeapYear = getIsLeapYear;
    proto.weekYear    = getSetWeekYear;
    proto.isoWeekYear = getSetISOWeekYear;
    proto.quarter = proto.quarters = getSetQuarter;
    proto.month       = getSetMonth;
    proto.daysInMonth = getDaysInMonth;
    proto.week           = proto.weeks        = getSetWeek;
    proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
    proto.weeksInYear    = getWeeksInYear;
    proto.isoWeeksInYear = getISOWeeksInYear;
    proto.date       = getSetDayOfMonth;
    proto.day        = proto.days             = getSetDayOfWeek;
    proto.weekday    = getSetLocaleDayOfWeek;
    proto.isoWeekday = getSetISODayOfWeek;
    proto.dayOfYear  = getSetDayOfYear;
    proto.hour = proto.hours = getSetHour;
    proto.minute = proto.minutes = getSetMinute;
    proto.second = proto.seconds = getSetSecond;
    proto.millisecond = proto.milliseconds = getSetMillisecond;
    proto.utcOffset            = getSetOffset;
    proto.utc                  = setOffsetToUTC;
    proto.local                = setOffsetToLocal;
    proto.parseZone            = setOffsetToParsedOffset;
    proto.hasAlignedHourOffset = hasAlignedHourOffset;
    proto.isDST                = isDaylightSavingTime;
    proto.isLocal              = isLocal;
    proto.isUtcOffset          = isUtcOffset;
    proto.isUtc                = isUtc;
    proto.isUTC                = isUtc;
    proto.zoneAbbr = getZoneAbbr;
    proto.zoneName = getZoneName;
    proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
    proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
    proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
    proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
    proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

    function createUnix (input) {
        return createLocal(input * 1000);
    }

    function createInZone () {
        return createLocal.apply(null, arguments).parseZone();
    }

    function preParsePostFormat (string) {
        return string;
    }

    var proto$1 = Locale.prototype;

    proto$1.calendar        = calendar;
    proto$1.longDateFormat  = longDateFormat;
    proto$1.invalidDate     = invalidDate;
    proto$1.ordinal         = ordinal;
    proto$1.preparse        = preParsePostFormat;
    proto$1.postformat      = preParsePostFormat;
    proto$1.relativeTime    = relativeTime;
    proto$1.pastFuture      = pastFuture;
    proto$1.set             = set;

    proto$1.months            =        localeMonths;
    proto$1.monthsShort       =        localeMonthsShort;
    proto$1.monthsParse       =        localeMonthsParse;
    proto$1.monthsRegex       = monthsRegex;
    proto$1.monthsShortRegex  = monthsShortRegex;
    proto$1.week = localeWeek;
    proto$1.firstDayOfYear = localeFirstDayOfYear;
    proto$1.firstDayOfWeek = localeFirstDayOfWeek;

    proto$1.weekdays       =        localeWeekdays;
    proto$1.weekdaysMin    =        localeWeekdaysMin;
    proto$1.weekdaysShort  =        localeWeekdaysShort;
    proto$1.weekdaysParse  =        localeWeekdaysParse;

    proto$1.weekdaysRegex       =        weekdaysRegex;
    proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
    proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

    proto$1.isPM = localeIsPM;
    proto$1.meridiem = localeMeridiem;

    function get$1 (format, index, field, setter) {
        var locale = getLocale();
        var utc = createUTC().set(setter, index);
        return locale[field](utc, format);
    }

    function listMonthsImpl (format, index, field) {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';

        if (index != null) {
            return get$1(format, index, field, 'month');
        }

        var i;
        var out = [];
        for (i = 0; i < 12; i++) {
            out[i] = get$1(format, i, field, 'month');
        }
        return out;
    }

    // ()
    // (5)
    // (fmt, 5)
    // (fmt)
    // (true)
    // (true, 5)
    // (true, fmt, 5)
    // (true, fmt)
    function listWeekdaysImpl (localeSorted, format, index, field) {
        if (typeof localeSorted === 'boolean') {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        } else {
            format = localeSorted;
            index = format;
            localeSorted = false;

            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';
        }

        var locale = getLocale(),
            shift = localeSorted ? locale._week.dow : 0;

        if (index != null) {
            return get$1(format, (index + shift) % 7, field, 'day');
        }

        var i;
        var out = [];
        for (i = 0; i < 7; i++) {
            out[i] = get$1(format, (i + shift) % 7, field, 'day');
        }
        return out;
    }

    function listMonths (format, index) {
        return listMonthsImpl(format, index, 'months');
    }

    function listMonthsShort (format, index) {
        return listMonthsImpl(format, index, 'monthsShort');
    }

    function listWeekdays (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
    }

    function listWeekdaysShort (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
    }

    function listWeekdaysMin (localeSorted, format, index) {
        return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
    }

    getSetGlobalLocale('en', {
        dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    // Side effect imports

    hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
    hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

    var mathAbs = Math.abs;

    function abs () {
        var data           = this._data;

        this._milliseconds = mathAbs(this._milliseconds);
        this._days         = mathAbs(this._days);
        this._months       = mathAbs(this._months);

        data.milliseconds  = mathAbs(data.milliseconds);
        data.seconds       = mathAbs(data.seconds);
        data.minutes       = mathAbs(data.minutes);
        data.hours         = mathAbs(data.hours);
        data.months        = mathAbs(data.months);
        data.years         = mathAbs(data.years);

        return this;
    }

    function addSubtract$1 (duration, input, value, direction) {
        var other = createDuration(input, value);

        duration._milliseconds += direction * other._milliseconds;
        duration._days         += direction * other._days;
        duration._months       += direction * other._months;

        return duration._bubble();
    }

    // supports only 2.0-style add(1, 's') or add(duration)
    function add$1 (input, value) {
        return addSubtract$1(this, input, value, 1);
    }

    // supports only 2.0-style subtract(1, 's') or subtract(duration)
    function subtract$1 (input, value) {
        return addSubtract$1(this, input, value, -1);
    }

    function absCeil (number) {
        if (number < 0) {
            return Math.floor(number);
        } else {
            return Math.ceil(number);
        }
    }

    function bubble () {
        var milliseconds = this._milliseconds;
        var days         = this._days;
        var months       = this._months;
        var data         = this._data;
        var seconds, minutes, hours, years, monthsFromDays;

        // if we have a mix of positive and negative values, bubble down first
        // check: https://github.com/moment/moment/issues/2166
        if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
                (milliseconds <= 0 && days <= 0 && months <= 0))) {
            milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
            days = 0;
            months = 0;
        }

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;

        seconds           = absFloor(milliseconds / 1000);
        data.seconds      = seconds % 60;

        minutes           = absFloor(seconds / 60);
        data.minutes      = minutes % 60;

        hours             = absFloor(minutes / 60);
        data.hours        = hours % 24;

        days += absFloor(hours / 24);

        // convert days to months
        monthsFromDays = absFloor(daysToMonths(days));
        months += monthsFromDays;
        days -= absCeil(monthsToDays(monthsFromDays));

        // 12 months -> 1 year
        years = absFloor(months / 12);
        months %= 12;

        data.days   = days;
        data.months = months;
        data.years  = years;

        return this;
    }

    function daysToMonths (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        // 400 years have 12 months === 4800
        return days * 4800 / 146097;
    }

    function monthsToDays (months) {
        // the reverse of daysToMonths
        return months * 146097 / 4800;
    }

    function as (units) {
        if (!this.isValid()) {
            return NaN;
        }
        var days;
        var months;
        var milliseconds = this._milliseconds;

        units = normalizeUnits(units);

        if (units === 'month' || units === 'quarter' || units === 'year') {
            days = this._days + milliseconds / 864e5;
            months = this._months + daysToMonths(days);
            switch (units) {
                case 'month':   return months;
                case 'quarter': return months / 3;
                case 'year':    return months / 12;
            }
        } else {
            // handle milliseconds separately because of floating point math errors (issue #1867)
            days = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
                case 'week'   : return days / 7     + milliseconds / 6048e5;
                case 'day'    : return days         + milliseconds / 864e5;
                case 'hour'   : return days * 24    + milliseconds / 36e5;
                case 'minute' : return days * 1440  + milliseconds / 6e4;
                case 'second' : return days * 86400 + milliseconds / 1000;
                // Math.floor prevents floating point math errors here
                case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
                default: throw new Error('Unknown unit ' + units);
            }
        }
    }

    // TODO: Use this.as('ms')?
    function valueOf$1 () {
        if (!this.isValid()) {
            return NaN;
        }
        return (
            this._milliseconds +
            this._days * 864e5 +
            (this._months % 12) * 2592e6 +
            toInt(this._months / 12) * 31536e6
        );
    }

    function makeAs (alias) {
        return function () {
            return this.as(alias);
        };
    }

    var asMilliseconds = makeAs('ms');
    var asSeconds      = makeAs('s');
    var asMinutes      = makeAs('m');
    var asHours        = makeAs('h');
    var asDays         = makeAs('d');
    var asWeeks        = makeAs('w');
    var asMonths       = makeAs('M');
    var asQuarters     = makeAs('Q');
    var asYears        = makeAs('y');

    function clone$1 () {
        return createDuration(this);
    }

    function get$2 (units) {
        units = normalizeUnits(units);
        return this.isValid() ? this[units + 's']() : NaN;
    }

    function makeGetter(name) {
        return function () {
            return this.isValid() ? this._data[name] : NaN;
        };
    }

    var milliseconds = makeGetter('milliseconds');
    var seconds      = makeGetter('seconds');
    var minutes      = makeGetter('minutes');
    var hours        = makeGetter('hours');
    var days         = makeGetter('days');
    var months       = makeGetter('months');
    var years        = makeGetter('years');

    function weeks () {
        return absFloor(this.days() / 7);
    }

    var round = Math.round;
    var thresholds = {
        ss: 44,         // a few seconds to seconds
        s : 45,         // seconds to minute
        m : 45,         // minutes to hour
        h : 22,         // hours to day
        d : 26,         // days to month
        M : 11          // months to year
    };

    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
        var duration = createDuration(posNegDuration).abs();
        var seconds  = round(duration.as('s'));
        var minutes  = round(duration.as('m'));
        var hours    = round(duration.as('h'));
        var days     = round(duration.as('d'));
        var months   = round(duration.as('M'));
        var years    = round(duration.as('y'));

        var a = seconds <= thresholds.ss && ['s', seconds]  ||
                seconds < thresholds.s   && ['ss', seconds] ||
                minutes <= 1             && ['m']           ||
                minutes < thresholds.m   && ['mm', minutes] ||
                hours   <= 1             && ['h']           ||
                hours   < thresholds.h   && ['hh', hours]   ||
                days    <= 1             && ['d']           ||
                days    < thresholds.d   && ['dd', days]    ||
                months  <= 1             && ['M']           ||
                months  < thresholds.M   && ['MM', months]  ||
                years   <= 1             && ['y']           || ['yy', years];

        a[2] = withoutSuffix;
        a[3] = +posNegDuration > 0;
        a[4] = locale;
        return substituteTimeAgo.apply(null, a);
    }

    // This function allows you to set the rounding function for relative time strings
    function getSetRelativeTimeRounding (roundingFunction) {
        if (roundingFunction === undefined) {
            return round;
        }
        if (typeof(roundingFunction) === 'function') {
            round = roundingFunction;
            return true;
        }
        return false;
    }

    // This function allows you to set a threshold for relative time strings
    function getSetRelativeTimeThreshold (threshold, limit) {
        if (thresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return thresholds[threshold];
        }
        thresholds[threshold] = limit;
        if (threshold === 's') {
            thresholds.ss = limit - 1;
        }
        return true;
    }

    function humanize (withSuffix) {
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var locale = this.localeData();
        var output = relativeTime$1(this, !withSuffix, locale);

        if (withSuffix) {
            output = locale.pastFuture(+this, output);
        }

        return locale.postformat(output);
    }

    var abs$1 = Math.abs;

    function sign(x) {
        return ((x > 0) - (x < 0)) || +x;
    }

    function toISOString$1() {
        // for ISO strings we do not use the normal bubbling rules:
        //  * milliseconds bubble up until they become hours
        //  * days do not bubble at all
        //  * months bubble up until they become years
        // This is because there is no context-free conversion between hours and days
        // (think of clock changes)
        // and also not between days and months (28-31 days per month)
        if (!this.isValid()) {
            return this.localeData().invalidDate();
        }

        var seconds = abs$1(this._milliseconds) / 1000;
        var days         = abs$1(this._days);
        var months       = abs$1(this._months);
        var minutes, hours, years;

        // 3600 seconds -> 60 minutes -> 1 hour
        minutes           = absFloor(seconds / 60);
        hours             = absFloor(minutes / 60);
        seconds %= 60;
        minutes %= 60;

        // 12 months -> 1 year
        years  = absFloor(months / 12);
        months %= 12;


        // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
        var Y = years;
        var M = months;
        var D = days;
        var h = hours;
        var m = minutes;
        var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
        var total = this.asSeconds();

        if (!total) {
            // this is the same as C#'s (Noda) and python (isodate)...
            // but not other JS (goog.date)
            return 'P0D';
        }

        var totalSign = total < 0 ? '-' : '';
        var ymSign = sign(this._months) !== sign(total) ? '-' : '';
        var daysSign = sign(this._days) !== sign(total) ? '-' : '';
        var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

        return totalSign + 'P' +
            (Y ? ymSign + Y + 'Y' : '') +
            (M ? ymSign + M + 'M' : '') +
            (D ? daysSign + D + 'D' : '') +
            ((h || m || s) ? 'T' : '') +
            (h ? hmsSign + h + 'H' : '') +
            (m ? hmsSign + m + 'M' : '') +
            (s ? hmsSign + s + 'S' : '');
    }

    var proto$2 = Duration.prototype;

    proto$2.isValid        = isValid$1;
    proto$2.abs            = abs;
    proto$2.add            = add$1;
    proto$2.subtract       = subtract$1;
    proto$2.as             = as;
    proto$2.asMilliseconds = asMilliseconds;
    proto$2.asSeconds      = asSeconds;
    proto$2.asMinutes      = asMinutes;
    proto$2.asHours        = asHours;
    proto$2.asDays         = asDays;
    proto$2.asWeeks        = asWeeks;
    proto$2.asMonths       = asMonths;
    proto$2.asQuarters     = asQuarters;
    proto$2.asYears        = asYears;
    proto$2.valueOf        = valueOf$1;
    proto$2._bubble        = bubble;
    proto$2.clone          = clone$1;
    proto$2.get            = get$2;
    proto$2.milliseconds   = milliseconds;
    proto$2.seconds        = seconds;
    proto$2.minutes        = minutes;
    proto$2.hours          = hours;
    proto$2.days           = days;
    proto$2.weeks          = weeks;
    proto$2.months         = months;
    proto$2.years          = years;
    proto$2.humanize       = humanize;
    proto$2.toISOString    = toISOString$1;
    proto$2.toString       = toISOString$1;
    proto$2.toJSON         = toISOString$1;
    proto$2.locale         = locale;
    proto$2.localeData     = localeData;

    proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
    proto$2.lang = lang;

    // Side effect imports

    // FORMATTING

    addFormatToken('X', 0, 0, 'unix');
    addFormatToken('x', 0, 0, 'valueOf');

    // PARSING

    addRegexToken('x', matchSigned);
    addRegexToken('X', matchTimestamp);
    addParseToken('X', function (input, array, config) {
        config._d = new Date(parseFloat(input, 10) * 1000);
    });
    addParseToken('x', function (input, array, config) {
        config._d = new Date(toInt(input));
    });

    // Side effect imports


    hooks.version = '2.24.0';

    setHookCallback(createLocal);

    hooks.fn                    = proto;
    hooks.min                   = min;
    hooks.max                   = max;
    hooks.now                   = now;
    hooks.utc                   = createUTC;
    hooks.unix                  = createUnix;
    hooks.months                = listMonths;
    hooks.isDate                = isDate;
    hooks.locale                = getSetGlobalLocale;
    hooks.invalid               = createInvalid;
    hooks.duration              = createDuration;
    hooks.isMoment              = isMoment;
    hooks.weekdays              = listWeekdays;
    hooks.parseZone             = createInZone;
    hooks.localeData            = getLocale;
    hooks.isDuration            = isDuration;
    hooks.monthsShort           = listMonthsShort;
    hooks.weekdaysMin           = listWeekdaysMin;
    hooks.defineLocale          = defineLocale;
    hooks.updateLocale          = updateLocale;
    hooks.locales               = listLocales;
    hooks.weekdaysShort         = listWeekdaysShort;
    hooks.normalizeUnits        = normalizeUnits;
    hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
    hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
    hooks.calendarFormat        = getCalendarFormat;
    hooks.prototype             = proto;

    // currently HTML5 input type only supports 24-hour formats
    hooks.HTML5_FMT = {
        DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
        DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
        DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
        DATE: 'YYYY-MM-DD',                             // <input type="date" />
        TIME: 'HH:mm',                                  // <input type="time" />
        TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
        TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
        WEEK: 'GGGG-[W]WW',                             // <input type="week" />
        MONTH: 'YYYY-MM'                                // <input type="month" />
    };

    return hooks;

})));

},{}],55:[function(require,module,exports){
const Currency = require('./../../lang/Currency'),
      Money = require('./../../lang/Money');

const DataType = require('./DataType'),
      Field = require('./Field');

module.exports = (() => {
  'use strict';
  /**
   * A complex object built from many {@link Field} instances.
   *
   * @public
   * @param {String} name
   * @param {Array<Field>} componentType
   */

  class Component {
    constructor(name, fields, reviver) {
      this._name = name;
      this._fields = fields || [];
      this._reviver = reviver;
    }
    /**
     * Name of the component.
     *
     * @public
     * @returns {String}
     */


    get name() {
      return this._name;
    }
    /**
     * Type of the component.
     *
     * @public
     * @returns {ComponentType}
     */


    get fields() {
      return this._fields;
    }
    /**
     * The reviver used to rebuild the entire component.
     *
     * @returns {Function}
     */


    get reviver() {
      return this._reviver;
    }
    /**
     * The builds a {@link Component} for {@link Money}.
     *
     * @public
     * @returns {Component}
     */


    static forMoney(name) {
      return new Component(name, [new Field('decimal', DataType.DECIMAL), new Field('currency', DataType.forEnum(Currency, 'Currency'))], x => Money.parse(x));
    }

    toString() {
      return `[Component (name=${this._name})]`;
    }

  }

  return Component;
})();

},{"./../../lang/Currency":20,"./../../lang/Money":25,"./DataType":56,"./Field":57}],56:[function(require,module,exports){
const moment = require('moment');

const AdHoc = require('./../../lang/AdHoc'),
      assert = require('./../../lang/assert'),
      Day = require('./../../lang/Day'),
      Decimal = require('./../../lang/Decimal'),
      Enum = require('./../../lang/Enum'),
      is = require('./../../lang/is'),
      Timestamp = require('./../../lang/Timestamp');

module.exports = (() => {
  'use strict';
  /**
   * The formal definition of a data type which is used by an {@link Field}.
   *
   * @public
   * @param {String} description
   * @param {Function=} enumerationType
   */

  class DataType {
    constructor(description, enumerationType, reviver, validator, builder) {
      assert.argumentIsRequired(description, 'description', String);
      assert.argumentIsOptional(enumerationType, 'enumerationType', Function);
      assert.argumentIsOptional(reviver, 'reviver', Function);
      assert.argumentIsOptional(validator, 'validator', Function);
      assert.argumentIsOptional(builder, 'builder', Function);

      if (enumerationType) {
        assert.argumentIsValid(enumerationType, 'enumerationType', extendsEnumeration, 'is an enumeration');
      }

      this._description = description;
      this._enumerationType = enumerationType || null;
      let reviverToUse;

      if (reviver) {
        reviverToUse = reviver;
      } else if (enumerationType) {
        reviverToUse = x => Enum.fromCode(enumerationType, x);
      } else {
        reviverToUse = x => x;
      }

      this._reviver = reviverToUse;
      let validatorToUse;

      if (validator) {
        validatorToUse = validator;
      } else {
        validatorToUse = candidate => true;
      }

      this._validator = validatorToUse;
      let builderToUse;

      if (builder) {
        builderToUse = builder;
      } else {
        builderToUse = data => data;
      }

      this._builder = builderToUse;
    }
    /**
     * A function that converts data into the desired format.
     *
     * @public
     * @param {*} data
     * @returns {*}
     */


    convert(data) {
      return this._builder(data);
    }
    /**
     * Description of the data type.
     *
     * @public
     * @returns {String}
     */


    get description() {
      return this._description;
    }
    /**
     * The {@Enumeration} type, if applicable.
     *
     * @public
     * @returns {Function|null}
     */


    get enumerationType() {
      return this._enumerationType;
    }
    /**
     * A function which "revives" a value after serialization to JSON.
     *
     * @public
     * @returns {Function}
     */


    get reviver() {
      return this._reviver;
    }
    /**
     * A function validates data, returning true or false.
     *
     * @public
     * @returns {Function}
     */


    get validator() {
      return this._validator;
    }
    /**
     * Return a {@link DataType} instance for use with an {@link @Enum}.
     *
     * @public
     * @param {Function} enumerationType - A class that extends {@link Enum}
     * @param description - The description
     * @returns {DataType}
     */


    static forEnum(enumerationType, description) {
      return new DataType(description, enumerationType, null, x => x instanceof enumerationType, getBuilder(getEnumerationBuilder(enumerationType)));
    }
    /**
     * References a string.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get STRING() {
      return dataTypeString;
    }
    /**
     * References a number.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get NUMBER() {
      return dataTypeNumber;
    }
    /**
     * References a Boolean value.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get BOOLEAN() {
      return dataTypeBoolean;
    }
    /**
     * References an object (serialized as JSON).
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get OBJECT() {
      return dataTypeObject;
    }
    /**
     * References an array.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get ARRAY() {
      return dataTypeArray;
    }
    /**
     * References a {@link Decimal} instance.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get DECIMAL() {
      return dataTypeDecimal;
    }
    /**
     * References a {@link Day} instance.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get DAY() {
      return dataTypeDay;
    }
    /**
     * References a {@link Timestamp} instance.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get TIMESTAMP() {
      return dataTypeTimestamp;
    }
    /**
     * References a {@link Timestamp} instance.
     *
     * @public
     * @static
     * @returns {DataType}
     */


    static get AD_HOC() {
      return dataTypeAdHoc;
    }

    toString() {
      return `[DataType (description=${this._description})]`;
    }

  }

  function extendsEnumeration(EnumerationType) {
    return is.extension(Enum, EnumerationType);
  }

  const dataTypeString = new DataType('String', null, null, is.string);
  const dataTypeNumber = new DataType('Number', null, null, is.number);
  const dataTypeBoolean = new DataType('Boolean', null, null, is.boolean);
  const dataTypeObject = new DataType('Object', null, null, is.object);
  const dataTypeArray = new DataType('Array', null, null, is.array);
  const dataTypeDecimal = new DataType('Decimal', null, x => Decimal.parse(x), x => x instanceof Decimal, getBuilder(buildDecimal));
  const dataTypeDay = new DataType('Day', null, x => Day.parse(x), x => x instanceof Day, getBuilder(buildDay));
  const dataTypeTimestamp = new DataType('Timestamp', null, x => Timestamp.parse(x), x => x instanceof Timestamp, getBuilder(buildTimestamp));
  const dataTypeAdHoc = new DataType('AdHoc', null, x => AdHoc.parse(x), x => x instanceof AdHoc, getBuilder(buildAdHoc));

  function getBuilder(builder) {
    return data => {
      try {
        return builder(data);
      } catch (e) {
        return data;
      }
    };
  }

  function buildDecimal(data) {
    return new Decimal(data);
  }

  function buildDay(data) {
    if (data instanceof Day) {
      return new Day(data.year, data.month, data.day);
    } else if (is.date(data)) {
      return Day.fromDate(data);
    } else if (is.string(data)) {
      return Day.parse(data);
    } else if (data instanceof moment) {
      return new Day(data.year(), data.month() + 1, data.date());
    } else {
      return data;
    }
  }

  function buildTimestamp(data) {
    return new Timestamp(data);
  }

  function buildAdHoc(data) {
    if (data instanceof AdHoc) {
      return new AdHoc(data.data);
    } else if (is.object(data)) {
      return new AdHoc(data);
    }
  }

  function getEnumerationBuilder(enumerationType) {
    return data => {
      if (is.string(data)) {
        return Enum.fromCode(enumerationType, data);
      } else {
        return data;
      }
    };
  }

  return DataType;
})();

},{"./../../lang/AdHoc":19,"./../../lang/Day":21,"./../../lang/Decimal":22,"./../../lang/Enum":24,"./../../lang/Timestamp":27,"./../../lang/assert":30,"./../../lang/is":36,"moment":54}],57:[function(require,module,exports){
module.exports = (() => {
  'use strict';
  /**
   * A simple field.
   *
   * @public
   * @param {String} name
   * @param {DataType} dataType
   * @param {Boolean} optional
   */

  class Field {
    constructor(name, dataType, optional) {
      this._name = name;
      this._dataType = dataType;
      this._optional = optional || false;
    }
    /**
     * Name of the field.
     *
     * @public
     * @returns {String}
     */


    get name() {
      return this._name;
    }
    /**
     * Type of the field.
     *
     * @public
     * @returns {DataType}
     */


    get dataType() {
      return this._dataType;
    }
    /**
     * Indicates if the field can be omitted without violating the schema.
     *
     * @public
     * @returns {Boolean}
     */


    get optional() {
      return this._optional;
    }

    toString() {
      return `[Field (name=${this._name})]`;
    }

  }

  return Field;
})();

},{}],58:[function(require,module,exports){
const attributes = require('./../../lang/attributes'),
      functions = require('./../../lang/functions'),
      is = require('./../../lang/is');

const LinkedList = require('./../../collections/LinkedList'),
      Tree = require('./../../collections/Tree');

const Component = require('./Component'),
      Field = require('./Field');

module.exports = (() => {
  'use strict';
  /**
   * A schema definition, can be used for serialization and deserialization.
   *
   * @public
   * @param {String} name - The name of the schema
   * @param {Array<Field>} fields
   * @param {Array<Component>} components
   * @param {Boolean=} strict
   */

  class Schema {
    constructor(name, fields, components, strict) {
      this._name = name;
      this._fields = fields || [];
      this._components = components || [];
      this._strict = is.boolean(strict) && strict;
      this._revivers = getReviverItems(this._fields, this._components);
    }
    /**
     * Accepts data and returns a new object which (should) conform to
     * the schema.
     *
     * @public
     * @param {Object} data
     * @returns {Object}
     */


    format(data) {
      const returnRef = {};

      this._fields.forEach(field => {
        formatField(returnRef, field, data);
      });

      this._components.forEach(component => {
        component.fields.forEach(field => {
          formatField(returnRef, field, data);
        });
      });

      return returnRef;
    }
    /**
     * Name of the table.
     *
     * @public
     * @returns {String}
     */


    get name() {
      return this._name;
    }
    /**
     * The fields of the table.
     *
     * @public
     * @returns {Array<Field>}
     */


    get fields() {
      return [...this._fields];
    }
    /**
     * The components of the table.
     *
     * @public
     * @returns {Array<Component>}
     */


    get components() {
      return [...this._components];
    }
    /**
     * If true, only the explicitly defined fields and components will
     * be serialized.
     *
     * @public
     * @returns {boolean}
     */


    get strict() {
      return this._strict;
    }
    /**
     * Returns true, if an object complies with the schema.
     *
     * @public
     * @param {*} candidate
     * @returns {Boolean}
     */


    validate(candidate) {
      return !getCandidateIsInvalid(candidate) && this.getInvalidFields(candidate).length === 0;
    }
    /**
     * Returns an array of {@link Field} objects from the schema for which the
     * candidate object does not comply with.
     *
     * @public
     * @param {*} candidate
     * @returns {Field[]}
     */


    getInvalidFields(candidate) {
      if (getCandidateIsInvalid(candidate)) {
        return this.fields.filter(f => !f.optional);
      }

      return this.fields.reduce((problems, field) => {
        let check = !field.optional || attributes.has(candidate, field.name);

        if (check) {
          const valid = field.dataType.validator.call(this, attributes.read(candidate, field.name));

          if (!valid) {
            problems.push(field);
          }
        }

        return problems;
      }, []);
    }
    /**
     * Generates a function suitable for use by {@link JSON.parse}.
     *
     * @public
     * @returns {Function}
     */


    getReviver() {
      let head = this._revivers;
      let node = null;

      const advance = key => {
        if (node === null) {
          node = head;
        } else {
          node = node.getNext();
        }

        let item = node.getValue();

        if (key !== item.name) {
          if (item.reset || key === '' && node === head) {
            node = null;
          } else if (item.optional) {
            item = advance(key);
          } else {
            throw new SchemaError(key, item.name, `Schema parsing is using strict mode, unexpected key found [ found: ${key}, expected: ${item.name} ]`);
          }
        }

        return item;
      };

      return (key, value) => {
        const item = advance(key);

        if (key === '') {
          return value;
        } else {
          return item.reviver(value);
        }
      };
    }
    /**
     * Returns a function that will generate a *new* reviver function
     * (see {@link Schema#getReviver}.
     *
     * @public
     * @returns {Function}
     */


    getReviverFactory() {
      return () => this.getReviver();
    }

    toString() {
      return `[Schema (name=${this._name})]`;
    }

  }

  class SchemaError extends Error {
    constructor(key, name, message) {
      super(message);
      this.key = key;
      this.name = name;
    }

    toString() {
      return `[SchemaError]`;
    }

  }

  class ReviverItem {
    constructor(name, reviver, optional, reset) {
      this._name = name;
      this._reviver = reviver || functions.getTautology();
      this._optional = is.boolean(optional) && optional;
      this._reset = is.boolean(reset) && reset;
    }

    get name() {
      return this._name;
    }

    get reviver() {
      return this._reviver;
    }

    get optional() {
      return this._optional;
    }

    get reset() {
      return this._reset;
    }

  }

  function getReviverItems(fields, components) {
    const root = new Tree(new ReviverItem(null, null, false, true)); // 2017/08/26, BRI. The Field and Component types could inherit a common
    // type, allowing the following duplication to be avoided with polymorphism.

    fields.forEach(field => {
      const names = field.name.split('.');
      let node = root;
      names.forEach((name, i) => {
        if (names.length === i + 1) {
          node.addChild(new ReviverItem(name, field.dataType.reviver, field.optional));
        } else {
          let child = node.findChild(n => n.name === name);

          if (!child) {
            child = node.addChild(new ReviverItem(name));
          }

          node = child;
        }
      });
    });
    components.forEach(component => {
      let node = root;
      const names = component.name.split('.');
      names.forEach((name, i) => {
        if (names.length === i + 1) {
          node = node.addChild(new ReviverItem(name, component.reviver));
        } else {
          let child = node.findChild(n => n.name === name);

          if (!child) {
            child = node.addChild(new ReviverItem(name));
          }

          node = child;
        }
      });
      component.fields.forEach(f => node.addChild(new ReviverItem(f.name, f.dataType.reviver)));
    });
    let head = null;
    let current = null;

    const addItemToList = (item, node) => {
      let itemToUse = item;

      if (!node.getIsLeaf()) {
        const required = node.search((i, n) => n.getIsLeaf() && !i.optional, true, false) !== null;

        if (!required) {
          itemToUse = new ReviverItem(item.name, item.reviver, true, item.reset);
        }
      } else {
        itemToUse = item;
      }

      if (current === null) {
        current = head = new LinkedList(itemToUse);
      } else {
        current = current.insert(itemToUse);
      }
    };

    root.walk(addItemToList, false, true);
    return head;
  }

  function formatField(target, field, data) {
    if (attributes.has(data, field.name)) {
      attributes.write(target, field.name, field.dataType.convert(attributes.read(data, field.name)));
    }
  }

  function getCandidateIsInvalid(candidate) {
    return is.undefined(candidate) || is.null(candidate) || !is.object(candidate);
  }

  return Schema;
})();

},{"./../../collections/LinkedList":4,"./../../collections/Tree":7,"./../../lang/attributes":31,"./../../lang/functions":35,"./../../lang/is":36,"./Component":55,"./Field":57}],59:[function(require,module,exports){
const assert = require('./../../../lang/assert');

const Component = require('./../Component'),
      DataType = require('./../DataType'),
      Field = require('./../Field');

module.exports = (() => {
  'use strict';
  /**
   * A fluent interface for building a {@link Component} instance.
   *
   * @public
   * @param {String} name - The name of the schema
   */

  class ComponentBuilder {
    constructor(name) {
      this._component = new Component(name);
    }
    /**
     * The {@link Schema} current schema instance.
     *
     * @public
     * @returns {Component}
     */


    get component() {
      return this._component;
    }
    /**
     * Adds a new {@link Field} to the schema and returns the current instance.
     *
     * @public
     * @param {String} name
     * @param {DataType} dataType
     * @returns {ComponentBuilder}
     */


    withField(name, dataType) {
      assert.argumentIsRequired(name, 'name', String);
      assert.argumentIsRequired(dataType, 'dataType', DataType, 'DataType');

      const fields = this._component.fields.concat([new Field(name, dataType)]);

      this._component = new Component(this._component.name, fields, this._component.reviver);
      return this;
    }
    /**
     * Adds a "reviver" function for use with JSON.parse.
     *
     * @public
     * @param {String} name
     * @param {DataType} dataType
     * @returns {ComponentBuilder}
     */


    withReviver(reviver) {
      assert.argumentIsRequired(reviver, 'reviver', Function);
      this._component = new Component(this._component.name, this._component.fields, reviver);
      return this;
    }

    toString() {
      return `[ComponentBuilder (name=${this._name})]`;
    }

  }

  return ComponentBuilder;
})();

},{"./../../../lang/assert":30,"./../Component":55,"./../DataType":56,"./../Field":57}],60:[function(require,module,exports){
const assert = require('./../../../lang/assert'),
      is = require('./../../../lang/is');

const Component = require('./../Component'),
      DataType = require('./../DataType'),
      Field = require('./../Field'),
      Schema = require('./../Schema');

const ComponentBuilder = require('./ComponentBuilder');

module.exports = (() => {
  'use strict';
  /**
   * A fluent interface for building a {@link Schema} instance.
   *
   * @public
   * @param {String} name - The name of the schema
   */

  class SchemaBuilder {
    constructor(name) {
      this._schema = new Schema(name);
    }
    /**
     * The {@link Schema} current schema instance.
     *
     * @public
     * @returns {Schema}
     */


    get schema() {
      return this._schema;
    }
    /**
     * Adds a new {@link Field} to the schema and returns the current instance.
     *
     * @public
     * @param {String} name - The name of the new field.
     * @param {DataType} dataType - The type of the new field.
     * @param {Boolean=} optional - If true, the field is not required and may be omitted.
     * @returns {SchemaBuilder}
     */


    withField(name, dataType, optional) {
      assert.argumentIsRequired(name, 'name', String);
      assert.argumentIsRequired(dataType, 'dataType', DataType, 'DataType');
      assert.argumentIsOptional(optional, 'optional', Boolean);
      const optionalToUse = is.boolean(optional) && optional;

      const fields = this._schema.fields.concat([new Field(name, dataType, optionalToUse)]);

      this._schema = new Schema(this._schema.name, fields, this._schema.components, this._schema.strict);
      return this;
    }
    /**
     * Adds a new {@link Component} to the schema, using a {@link ComponentBuilder}
     * and returns the current instance.
     *
     * @public
     * @param {String} name - The name of the new component.
     * @param {Function} callback - A callback to which the {@link ComponentBuilder} is passed synchronously.
     * @returns {SchemaBuilder}
     */


    withComponentBuilder(name, callback) {
      assert.argumentIsRequired(name, 'name', String);
      const componentBuilder = new ComponentBuilder(name);
      callback(componentBuilder);
      return this.withComponent(componentBuilder.component);
    }
    /**
     * Adds a new {@link Component} to the schema and returns the current instance.
     *
     * @public
     * @param {Component} component - The new component to add.
     * @returns {SchemaBuilder}
     */


    withComponent(component) {
      assert.argumentIsRequired(component, 'component', Component, 'Component');

      const components = this._schema.components.concat([component]);

      this._schema = new Schema(this._schema.name, this._schema.fields, components, this._schema.strict);
      return this;
    }
    /**
     * Creates a new {@link SchemaBuilder}.
     *
     * @public
     * @param {String} name
     * @returns {SchemaBuilder}
     */


    static withName(name) {
      assert.argumentIsRequired(name, 'name', String);
      return new SchemaBuilder(name);
    }

    toString() {
      return `[SchemaBuilder (name=${this._name})]`;
    }

  }

  return SchemaBuilder;
})();

},{"./../../../lang/assert":30,"./../../../lang/is":36,"./../Component":55,"./../DataType":56,"./../Field":57,"./../Schema":58,"./ComponentBuilder":59}],61:[function(require,module,exports){
const Specification = require('./Specification');

module.exports = (() => {
  'use strict';

  return Specification.And;
})();

},{"./Specification":72}],62:[function(require,module,exports){
const assert = require('./../lang/assert');

const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when the value of the data item
   * is between the values passed to the constructor
   *
   * @public
   * @extends {Specification}
   * @param {Number} value
   */

  class Between extends Specification {
    constructor(values) {
      super();
      assert.argumentIsArray(values, 'values', Number);
      this._values = values;
    }

    _evaluate(data) {
      assert.argumentIsRequired(data, 'data', Number);
      return data > this._values[0] && data < this._values[1];
    }

    toString() {
      return '[Between]';
    }

  }

  return Between;
})();

},{"./../lang/assert":30,"./Specification":72}],63:[function(require,module,exports){
const assert = require('./../lang/assert');

const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when an array (passed to the
   * constructor) contains the data item.
   *
   * @public
   * @extends {Specification}
   * @param {Array} value
   */

  class Contained extends Specification {
    constructor(value) {
      super();
      assert.argumentIsArray(value, 'value');
      this._value = value;
    }

    _evaluate(data) {
      return this._value.some(candidate => candidate === data);
    }

    toString() {
      return '[Contained]';
    }

  }

  return Contained;
})();

},{"./../lang/assert":30,"./Specification":72}],64:[function(require,module,exports){
const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when an item (passed to the
   * constructor) is contained within an array.
   *
   * @public
   * @extends {Specification}
   * @param {*} value
   */

  class Contains extends Specification {
    constructor(value) {
      super();
      this._value = value;
    }

    _evaluate(data) {
      return Array.isArray(data) && data.some(candidate => candidate === this._value);
    }

    toString() {
      return '[Contains]';
    }

  }

  return Contains;
})();

},{"./Specification":72}],65:[function(require,module,exports){
const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when an item (passed to the
   * constructor) is strictly equal to the data item.
   *
   * @public
   * @extends {Specification}
   * @param {*} value
   */

  class Equals extends Specification {
    constructor(value) {
      super();
      this._value = value;
    }

    _evaluate(data) {
      return data === this._value;
    }

    toString() {
      return '[Equals]';
    }

  }

  return Equals;
})();

},{"./Specification":72}],66:[function(require,module,exports){
const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that always fails.
   *
   * @public
   * @extends {Specification}
   */

  class Fail extends Specification {
    constructor() {
      super();
    }

    _evaluate(data) {
      return false;
    }

    toString() {
      return '[Fail]';
    }

  }

  return Fail;
})();

},{"./Specification":72}],67:[function(require,module,exports){
const is = require('./../lang/is');

const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when the value of the data item
   * is NaN.
   *
   * @public
   * @extends {Specification}
   * @param {*} value
   */

  class Nan extends Specification {
    constructor() {
      super();
    }

    _evaluate(data) {
      return is.nan(data);
    }

    toString() {
      return '[Nan]';
    }

  }

  return Nan;
})();

},{"./../lang/is":36,"./Specification":72}],68:[function(require,module,exports){
const Specification = require('./Specification');

module.exports = (() => {
  'use strict';

  return Specification.Not;
})();

},{"./Specification":72}],69:[function(require,module,exports){
const is = require('./../lang/is');

const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when the value of the data item
   * is a number.
   *
   * @public
   * @extends {Specification}
   * @param {*} value
   */

  class Numeric extends Specification {
    constructor() {
      super();
    }

    _evaluate(data) {
      return is.number(data);
    }

    toString() {
      return '[Numeric]';
    }

  }

  return Numeric;
})();

},{"./../lang/is":36,"./Specification":72}],70:[function(require,module,exports){
const Specification = require('./Specification');

module.exports = (() => {
  'use strict';

  return Specification.Or;
})();

},{"./Specification":72}],71:[function(require,module,exports){
const Specification = require('./Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that always passes.
   *
   * @public
   * @extends {Specification}
   */

  class Pass extends Specification {
    constructor() {
      super();
    }

    _evaluate(data) {
      return true;
    }

    toString() {
      return '[Pass]';
    }

  }

  return Pass;
})();

},{"./Specification":72}],72:[function(require,module,exports){
const assert = require('./../lang/assert');

module.exports = (() => {
  'use strict';
  /**
   * Simple implementation of a specification pattern, where instances
   * can be combined to form complex predicates.
   *
   * @public
   */

  class Specification {
    constructor() {}
    /**
     * Evaluates the specification, returning true or false.
     *
     * @public
     * @param {*=} data
     * @returns {Boolean}
     */


    evaluate(data) {
      return this._evaluate(data);
    }
    /**
     * @protected
     */


    _evaluate(data) {
      return false;
    }
    /**
     * Wraps the current instance and another {@link Specification} into a new
     * specification which only evaluates to true when both wrapped specifications
     * evaluate to true.
     *
     * @public
     * @param {Specification} other
     * @returns {And}
     */


    and(other) {
      assert.argumentIsRequired(other, 'other', Specification, 'Specification');
      return new And(this, other);
    }
    /**
     * Wraps the current instance and another {@link Specification} into a new
     * specification which only evaluates to true when either of the wrapped
     * specifications evaluate to true.
     *
     * @public
     * @param {Specification} other
     * @returns {Or}
     */


    or(other) {
      assert.argumentIsRequired(other, 'other', Specification, 'Specification');
      return new Or(this, other);
    }
    /**
     * Wraps the current instance in a new {@link Specification} which evaluates
     * to the inverse result of the wrapped specification.
     *
     * @public
     * @param {Specification} other
     * @returns {Not}
     */


    not() {
      return new Not(this);
    }

    toString() {
      return '[Specification]';
    }

  }

  class And extends Specification {
    constructor(specificationOne, specificationTwo) {
      super();
      assert.argumentIsRequired(specificationOne, 'specificationOne', Specification, 'Specification');
      assert.argumentIsRequired(specificationTwo, 'specificationTwo', Specification, 'Specification');
      this._specificationOne = specificationOne;
      this._specificationTwo = specificationTwo;
    }

    _evaluate(data) {
      return this._specificationOne.evaluate(data) && this._specificationTwo.evaluate(data);
    }

    toString() {
      return '[And]';
    }

  }

  class Or extends Specification {
    constructor(specificationOne, specificationTwo) {
      super();
      assert.argumentIsRequired(specificationOne, 'specificationOne', Specification, 'Specification');
      assert.argumentIsRequired(specificationTwo, 'specificationTwo', Specification, 'Specification');
      this._specificationOne = specificationOne;
      this._specificationTwo = specificationTwo;
    }

    _evaluate(data) {
      return this._specificationOne.evaluate(data) || this._specificationTwo.evaluate(data);
    }

    toString() {
      return '[Or]';
    }

  }

  class Not extends Specification {
    constructor(otherSpecification) {
      super();
      assert.argumentIsRequired(otherSpecification, 'otherSpecification', Specification, 'Specification');
      this._otherSpecification = otherSpecification;
    }

    _evaluate(data) {
      return !this._otherSpecification.evaluate(data);
    }

    toString() {
      return '[Not]';
    }

  }

  Specification.And = And;
  Specification.Or = Or;
  Specification.Not = Not;
  return Specification;
})();

},{"./../lang/assert":30}],73:[function(require,module,exports){
const assert = require('./../../lang/assert');

const Specification = require('./../Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when the first item in an
   * array is greater than the second item in the array.
   *
   * @public
   * @extends {Specification}
   */

  class GreaterThan extends Specification {
    constructor() {
      super();
    }

    _evaluate(data) {
      return Array.isArray(data) && data.length === 2 && data[0] > data[1];
    }

    toString() {
      return '[GreaterThan]';
    }

  }

  return GreaterThan;
})();

},{"./../../lang/assert":30,"./../Specification":72}],74:[function(require,module,exports){
const assert = require('./../../lang/assert');

const Specification = require('./../Specification');

module.exports = (() => {
  'use strict';
  /**
   * A {@link Specification} that passes when the first item in an
   * array is less than the second item in the array.
   *
   * @public
   * @extends {Specification}
   */

  class LessThan extends Specification {
    constructor() {
      super();
    }

    _evaluate(data) {
      return Array.isArray(data) && data.length === 2 && data[0] < data[1];
    }

    toString() {
      return '[LessThan]';
    }

  }

  return LessThan;
})();

},{"./../../lang/assert":30,"./../Specification":72}],75:[function(require,module,exports){
var Enum = require('./../../../../lang/Enum'),
    FailureReasonItem = require('./../../../../api/failures/FailureReasonItem'),
    FailureType = require('./../../../../api/failures/FailureType');

describe('When a FailureType is created with a template string that references root level data', function () {
  'use strict';

  var code;
  var template;
  var type;
  beforeEach(function () {
    code = 'TEST_ROOT';
    template = 'This is a test of the {root.system} system.';
    type = Enum.fromCode(FailureType, code) || new FailureType(code, template);
  });
  describe('and a FailureReasonItem is created using this FailureType', function () {
    var item;
    var root;
    beforeEach(function () {
      root = {
        system: 'Emergency Broadcast'
      };
      item = new FailureReasonItem(type, {});
    });
    describe('and the item is formatted', function () {
      var formatted;
      beforeEach(function () {
        formatted = item.format(root);
      });
      it('should match the expected output', function () {
        expect(formatted).toEqual('This is a test of the Emergency Broadcast system.');
      });
    });
  });
});
describe('When a FailureType is created with a template string that references with data points', function () {
  'use strict';

  var code;
  var template;
  var type;
  beforeEach(function () {
    code = 'TEST_MULTIPLE';
    template = 'I believe that "{argument.thesis}" is a {argument.conclusion} statement.';
    type = Enum.fromCode(FailureType, code) || new FailureType(code, template);
  });
  describe('and a FailureReasonItem is created using this FailureType', function () {
    var item;
    var root;
    var data;
    beforeEach(function () {
      root = {};
      data = {
        argument: {
          thesis: 'all cats are animals',
          conclusion: 'true'
        }
      };
      item = new FailureReasonItem(type, data);
    });
    describe('and the item is formatted', function () {
      var formatted;
      beforeEach(function () {
        formatted = item.format(root);
      });
      it('should match the expected output', function () {
        expect(formatted).toEqual('I believe that "all cats are animals" is a true statement.');
      });
    });
  });
});
describe('When a FailureType is created with a template string that references data points with casing changes', function () {
  'use strict';

  var code;
  var template;
  var type;
  beforeEach(function () {
    code = 'TEST_CASING';
    template = 'The first letter is lowercase: {l|name}. The first letter is uppercase: {u|name}. All letters are lowercase: {L|name}. All letters are uppercase: {U|name}.';
    type = Enum.fromCode(FailureType, code) || new FailureType(code, template);
  });
  describe('and a FailureReasonItem is created using this FailureType', function () {
    var item;
    var root;
    var data;
    beforeEach(function () {
      root = {};
      data = {
        name: 'Abraham Lincoln'
      };
      item = new FailureReasonItem(type, data);
    });
    describe('and the item is formatted', function () {
      var formatted;
      beforeEach(function () {
        formatted = item.format(root);
      });
      it('should match the expected output', function () {
        expect(formatted).toEqual('The first letter is lowercase: abraham Lincoln. The first letter is uppercase: Abraham Lincoln. All letters are lowercase: abraham lincoln. All letters are uppercase: ABRAHAM LINCOLN.');
      });
    });
  });
});

},{"./../../../../api/failures/FailureReasonItem":2,"./../../../../api/failures/FailureType":3,"./../../../../lang/Enum":24}],76:[function(require,module,exports){
var FailureReason = require('./../../../../api/failures/FailureReason'),
    FailureType = require('./../../../../api/failures/FailureType');

var DataType = require('./../../../../serialization/json/DataType'),
    Field = require('./../../../../serialization/json/Field'),
    Schema = require('./../../../../serialization/json/Schema');

describe('When a FailureReason is created', function () {
  'use strict';

  var reason;
  beforeEach(function () {
    reason = FailureReason.forRequest({
      endpoint: {
        description: 'do stuff'
      }
    }).addItem(FailureType.REQUEST_CONSTRUCTION_FAILURE, {}, true).addItem(FailureType.REQUEST_PARAMETER_MISSING, {
      name: 'First'
    }).addItem(FailureType.REQUEST_PARAMETER_MISSING, {
      name: 'Second'
    });
  });
  describe('and the FailureReason is checked for severity', function () {
    it('should be considered severe', function () {
      expect(reason.getIsSevere()).toEqual(true);
    });
  });
  describe('and the FailureReason is converted to a human-readable form', function () {
    var human;
    beforeEach(function () {
      human = reason.format();
    });
    it('should have one primary reason', function () {
      expect(human.length).toEqual(1);
    });
    it('should have two secondary reasons', function () {
      expect(human[0].children.length).toEqual(2);
    });
    it('should have the correct primary code', function () {
      expect(human[0].value.code).toEqual(FailureType.REQUEST_CONSTRUCTION_FAILURE.code);
    });
    it('should have the correct primary message', function () {
      expect(human[0].value.message).toEqual('An attempt to do stuff failed because some required information is missing.');
    });
    it('should have the correct secondary message (1)', function () {
      expect(human[0].children[0].value.message).toEqual('The "first" field is required.');
    });
    it('should have the correct secondary code (1)', function () {
      expect(human[0].children[0].value.code).toEqual(FailureType.REQUEST_PARAMETER_MISSING.code);
    });
    it('should have the correct secondary message (2)', function () {
      expect(human[0].children[1].value.message).toEqual('The "second" field is required.');
    });
    it('should have the correct secondary code (2)', function () {
      expect(human[0].children[1].value.code).toEqual(FailureType.REQUEST_PARAMETER_MISSING.code);
    });
  });
});
describe('When a schema is validated', function () {
  var schema;
  beforeEach(function () {
    schema = new Schema('person', [new Field('first', DataType.STRING), new Field('last', DataType.STRING)]);
  });
  describe('and a valid schema is processed', function () {
    var result;
    beforeEach(function (done) {
      FailureReason.validateSchema(schema, {
        first: 'bryan',
        last: 'ingle'
      }).then(r => {
        result = r;
        done();
      });
    });
    it('should return null (not a FailureReason)', function () {
      expect(result).toEqual(null);
    });
  });
  describe('and an invalid schema is processed (with one invalid property)', function () {
    var successResult = null;
    var failureResult = null;
    beforeEach(function (done) {
      FailureReason.validateSchema(schema, {
        first: 'bryan'
      }).then(r => {
        successResult = r;
        done();
      }).catch(e => {
        failureResult = e;
        done();
      });
    });
    it('should fail with a formatted failure reason', function () {
      expect(failureResult).not.toEqual(null);
    });
    it('should fail with a formatted failure reason, having one child', function () {
      expect(failureResult[0].children.length).toEqual(1);
    });
  });
  describe('and an invalid schema is processed (with two invalid properties)', function () {
    var successResult = null;
    var failureResult = null;
    beforeEach(function (done) {
      FailureReason.validateSchema(schema, {}).then(r => {
        successResult = r;
        done();
      }).catch(e => {
        failureResult = e;
        done();
      });
    });
    it('should fail with a formatted failure reason', function () {
      expect(failureResult).not.toEqual(null);
    });
    it('should fail with a formatted failure reason, having two children', function () {
      expect(failureResult[0].children.length).toEqual(2);
    });
  });
});

},{"./../../../../api/failures/FailureReason":1,"./../../../../api/failures/FailureType":3,"./../../../../serialization/json/DataType":56,"./../../../../serialization/json/Field":57,"./../../../../serialization/json/Schema":58}],77:[function(require,module,exports){
var LinkedList = require('./../../../collections/LinkedList');

describe('When "doe" is used to start a linked list', function () {
  'use strict';

  var doe;
  beforeEach(function () {
    doe = new LinkedList('doe');
  });
  describe('and "me" is added to "doe"', function () {
    var me;
    beforeEach(function () {
      me = doe.insert('me');
    });
    describe('and "ray" is inserted between "doe" and "me"', function () {
      var ray;
      beforeEach(function () {
        ray = doe.insert('ray');
      });
      it('the "ray" node should not be the the tail', function () {
        expect(me.getIsTail()).toEqual(true);
      });
      it('the "ray" node should have a value of "ray"', function () {
        expect(me.getValue()).toEqual('me');
      });
      it('the "me" node should still be the the tail', function () {
        expect(me.getIsTail()).toEqual(true);
      });
      it('the "doe" node should reference the "ray" node', function () {
        expect(doe.getNext()).toBe(ray);
      });
      it('the "ray" node should reference the "me" node', function () {
        expect(ray.getNext()).toBe(me);
      });
    });
    it('the "me" node should be the the tail', function () {
      expect(me.getIsTail()).toEqual(true);
    });
    it('the "me" node should have a value of "me"', function () {
      expect(me.getValue()).toEqual('me');
    });
    it('the "doe" node should not be the tail', function () {
      expect(doe.getIsTail()).toEqual(false);
    });
    it('the "doe" node should still have the correct value', function () {
      expect(doe.getValue()).toEqual('doe');
    });
    it('the "doe" node should reference the "me" node', function () {
      expect(doe.getNext()).toBe(me);
    });
  });
  it('should be the the tail', function () {
    expect(doe.getIsTail()).toEqual(true);
  });
  it('should have a value of "doe"', function () {
    expect(doe.getValue()).toEqual('doe');
  });
});

},{"./../../../collections/LinkedList":4}],78:[function(require,module,exports){
var Queue = require('./../../../collections/Queue');

describe('When a Queue is constructed', function () {
  'use strict';

  var queue;
  beforeEach(function () {
    queue = new Queue();
  });
  it('should be empty', function () {
    expect(queue.empty()).toEqual(true);
  });
  it('should throw if "peek" is called', function () {
    expect(function () {
      queue.peek();
    }).toThrow(new Error('Queue is empty'));
  });
  it('should throw if "dequeue" is called', function () {
    expect(function () {
      queue.peek();
    }).toThrow(new Error('Queue is empty'));
  });
  describe('and an object is enqueued', function () {
    var first = 1;
    beforeEach(function () {
      queue.enqueue(first);
    });
    it('should not be empty', function () {
      expect(queue.empty()).toEqual(false);
    });
    describe('and we peek at the top of the queue', function () {
      var peek;
      beforeEach(function () {
        peek = queue.peek();
      });
      it('the peek result should be the item enqueued', function () {
        expect(peek).toBe(first);
      });
      it('should not be empty', function () {
        expect(queue.empty()).toEqual(false);
      });
    });
    describe('and an object is dequeued', function () {
      var dequeue;
      beforeEach(function () {
        dequeue = queue.dequeue();
      });
      it('the dequeue result should be the item enqueued', function () {
        expect(dequeue).toBe(first);
      });
      it('should be empty', function () {
        expect(queue.empty()).toEqual(true);
      });
    });
    describe('and a second object is enqueued', function () {
      var second = {
        name: "second"
      };
      beforeEach(function () {
        queue.enqueue(second);
      });
      it('should not be empty', function () {
        expect(queue.empty()).toEqual(false);
      });
      describe('and we peek at the top of the queue', function () {
        var peek;
        beforeEach(function () {
          peek = queue.peek();
        });
        it('the peek result should be the first item enqueued', function () {
          expect(peek).toBe(first);
        });
        it('should not be empty', function () {
          expect(queue.empty()).toEqual(false);
        });
      });
      describe('and an object is dequeued', function () {
        var dequeue;
        beforeEach(function () {
          dequeue = queue.dequeue();
        });
        it('the dequeue result should be the first item enqueued', function () {
          expect(dequeue).toBe(first);
        });
        it('should not be empty', function () {
          expect(queue.empty()).toEqual(false);
        });
      });
      describe('and the queue is exported to an array', function () {
        var a;
        beforeEach(function () {
          a = queue.toArray();
        });
        it('should return an array with two items', function () {
          expect(a.length).toEqual(2);
        });
        it('the first item should be the first item enqueued', function () {
          expect(a[0]).toBe(first);
        });
        it('the second item should be the second item enqueued', function () {
          expect(a[1]).toBe(second);
        });
        it('should not be empty', function () {
          expect(queue.empty()).toEqual(false);
        });
      });
      describe('and the queue is scanned', function () {
        var spy;
        beforeEach(function () {
          spy = jasmine.createSpy();
          queue.scan(spy);
        });
        it('should call the delegate one time for each item in the queue', function () {
          expect(spy.calls.count()).toEqual(2);
        });
        it('should pass the first item to be pushed to the delegate first', function () {
          expect(spy.calls.argsFor(0)[0]).toBe(first);
        });
        it('should pass the second item to be pushed to the delegate second', function () {
          expect(spy.calls.argsFor(1)[0]).toBe(second);
        });
        it('should not be empty', function () {
          expect(queue.empty()).toEqual(false);
        });
      });
    });
  });
});

},{"./../../../collections/Queue":5}],79:[function(require,module,exports){
var Stack = require('./../../../collections/Stack');

describe('When a Stack is constructed', function () {
  'use strict';

  var stack;
  beforeEach(function () {
    stack = new Stack();
  });
  it('should be empty', function () {
    expect(stack.empty()).toEqual(true);
  });
  it('should throw if "peek" is called', function () {
    expect(function () {
      stack.peek();
    }).toThrow(new Error('Stack is empty'));
  });
  it('should throw if "pop" is called', function () {
    expect(function () {
      stack.peek();
    }).toThrow(new Error('Stack is empty'));
  });
  describe('and an object is pushed onto the stack', function () {
    var first = 1;
    beforeEach(function () {
      stack.push(first);
    });
    it('should not be empty', function () {
      expect(stack.empty()).toEqual(false);
    });
    describe('and we peek at the top of the stack', function () {
      var peek;
      beforeEach(function () {
        peek = stack.peek();
      });
      it('the peek result should be the item pushed onto the stack', function () {
        expect(peek).toBe(first);
      });
      it('should not be empty', function () {
        expect(stack.empty()).toEqual(false);
      });
    });
    describe('and an object is popped from the stack', function () {
      var pop;
      beforeEach(function () {
        pop = stack.pop();
      });
      it('the pop result should be the item pushed onto the stack', function () {
        expect(pop).toBe(first);
      });
      it('should be empty', function () {
        expect(stack.empty()).toEqual(true);
      });
    });
    describe('and a second object is pushed onto the stack', function () {
      var second = {
        name: "second"
      };
      beforeEach(function () {
        stack.push(second);
      });
      it('should not be empty', function () {
        expect(stack.empty()).toEqual(false);
      });
      describe('and we peek at the top of the stack', function () {
        var peek;
        beforeEach(function () {
          peek = stack.peek();
        });
        it('the peek result should be the second item pushed onto the stack', function () {
          expect(peek).toBe(second);
        });
        it('should not be empty', function () {
          expect(stack.empty()).toEqual(false);
        });
      });
      describe('and an object is popped from the stack', function () {
        var pop;
        beforeEach(function () {
          pop = stack.pop();
        });
        it('the pop result should be the second item pushed onto the stack', function () {
          expect(pop).toBe(second);
        });
        it('should not be empty', function () {
          expect(stack.empty()).toEqual(false);
        });
      });
      describe('and the queue is exported to an array', function () {
        var a;
        beforeEach(function () {
          a = stack.toArray();
        });
        it('should return an array with two items', function () {
          expect(a.length).toEqual(2);
        });
        it('the first item should be the second item pushed', function () {
          expect(a[0]).toBe(second);
        });
        it('the second item should be the first item pushed', function () {
          expect(a[1]).toBe(first);
        });
        it('should not be empty', function () {
          expect(stack.empty()).toEqual(false);
        });
      });
      describe('and the stack is scanned', function () {
        var spy;
        beforeEach(function () {
          spy = jasmine.createSpy();
          stack.scan(spy);
        });
        it('should call the delegate one time for each item in the queue', function () {
          expect(spy.calls.count()).toEqual(2);
        });
        it('should pass the second item to be pushed to the delegate first', function () {
          expect(spy.calls.argsFor(0)[0]).toBe(second);
        });
        it('should pass the first item to be pushed to the delegate second', function () {
          expect(spy.calls.argsFor(1)[0]).toBe(first);
        });
      });
    });
  });
});

},{"./../../../collections/Stack":6}],80:[function(require,module,exports){
var Tree = require('./../../../collections/Tree');

describe('When a Tree is constructed', function () {
  'use strict';

  var root;
  var one;
  beforeEach(function () {
    root = new Tree(one = {});
  });
  it('should be the root node', function () {
    expect(root.getIsRoot()).toEqual(true);
  });
  it('should be a leaf node', function () {
    expect(root.getIsLeaf()).toEqual(true);
  });
  it('should have to correct node value', function () {
    expect(root.getValue()).toBe(one);
  });
  describe('and the root node is retrieved from root node', function () {
    it('should be itself', function () {
      expect(root.getRoot()).toBe(root);
    });
  });
  describe('and a child is added', function () {
    var child;
    var two;
    beforeEach(function () {
      child = root.addChild(two = {});
    });
    it('should be a leaf node', function () {
      expect(child.getIsLeaf()).toEqual(true);
    });
    it('should have to correct node value', function () {
      expect(child.getValue()).toBe(two);
    });
    it('should should be the child of the root node', function () {
      expect(child.getParent()).toBe(root);
    });
    it('should not have a parent which is considered a leaf node', function () {
      expect(root.getIsLeaf()).toEqual(false);
    });
    it('should be in the parents collection of children', function () {
      expect(root.getChildren().find(c => c === child)).toBe(child);
    });
    describe('and a second child is added', function () {
      var secondChild;
      var three;
      beforeEach(function () {
        secondChild = root.addChild(three = {});
      });
      describe('and the second child is severed', function () {
        beforeEach(function () {
          secondChild.sever();
        });
        it('the severed tree should no longer have a parent', function () {
          expect(secondChild.getIsRoot()).toEqual(true);
        });
        it('the original tree should only contain one child', function () {
          expect(root.getChildren().length).toEqual(1);
        });
        it('the original tree should not be the severed node', function () {
          expect(root.getChildren()[0]).not.toBe(secondChild);
        });
      });
      describe('and the tree is converted to a JavaScript object', function () {
        var object;
        beforeEach(function () {
          object = root.toJSObj();
        });
        it('should have the correct root value', function () {
          expect(object.value).toBe(one);
        });
        it('should have two children', function () {
          expect(object.children.length).toEqual(2);
        });
        it('should have the correct value for the first child', function () {
          expect(object.children[0].value).toBe(two);
        });
        it('should have the correct value for the second child', function () {
          expect(object.children[1].value).toBe(three);
        });
      });
    });
    describe('and the root node is retrieved from the child', function () {
      it('should be the root node', function () {
        expect(child.getRoot()).toBe(root);
      });
    });
  });
});

},{"./../../../collections/Tree":7}],81:[function(require,module,exports){
var ComparatorBuilder = require('./../../../../collections/sorting/ComparatorBuilder');

describe('When a ComparatorBuilder is composed with two comparators', function () {
  'use strict';

  var comparatorBuilder;
  var comparatorOne;
  var comparatorTwo;
  var first = {
    x: 0,
    y: 0,
    toString: function () {
      return '[first]';
    }
  };
  var second = {
    x: 1,
    y: 0,
    toString: function () {
      return '[second]';
    }
  };
  var third = {
    x: 1,
    y: 1,
    toString: function () {
      return '[third]';
    }
  };
  beforeEach(function () {
    comparatorOne = jasmine.createSpy('comparatorOne').and.callFake(function (a, b) {
      return a.x - b.x;
    });
    comparatorTwo = jasmine.createSpy('comparatorTwo').and.callFake(function (a, b) {
      return a.y - b.y;
    });
    comparatorBuilder = ComparatorBuilder.startWith(comparatorOne).thenBy(comparatorTwo);
  });
  describe('and the ComparatorBuilder sorts an array (which requires both comparators)', function () {
    var arrayToSort;
    beforeEach(function () {
      arrayToSort = [third, first, second];
      arrayToSort.sort(comparatorBuilder.toComparator());
    });
    it('the first comparator should be invoked', function () {
      expect(comparatorOne).toHaveBeenCalled();
    });
    it('the second comparator should be invoked', function () {
      expect(comparatorTwo).toHaveBeenCalled();
    });
    it('the sorted array should be in the correct order', function () {
      expect(arrayToSort[0]).toBe(first);
      expect(arrayToSort[1]).toBe(second);
      expect(arrayToSort[2]).toBe(third);
    });
  });
  describe('and the ComparatorBuilder is inverted', function () {
    beforeEach(function () {
      comparatorBuilder = comparatorBuilder.invert();
    });
    describe('and the ComparatorBuilder sorts an array (which requires both comparators)', function () {
      var arrayToSort;
      beforeEach(function () {
        arrayToSort = [third, first, second];
        arrayToSort.sort(comparatorBuilder.toComparator());
      });
      it('the first comparator should be invoked', function () {
        expect(comparatorOne).toHaveBeenCalled();
      });
      it('the second comparator should be invoked', function () {
        expect(comparatorTwo).toHaveBeenCalled();
      });
      it('the sorted array should be in the correct order', function () {
        expect(arrayToSort[0]).toBe(third);
        expect(arrayToSort[1]).toBe(second);
        expect(arrayToSort[2]).toBe(first);
      });
    });
  });
});

},{"./../../../../collections/sorting/ComparatorBuilder":8}],82:[function(require,module,exports){
let comparators = require('./../../../../collections/sorting/comparators');

describe('When using the "compareDates" comparator', () => {
  'use strict';

  let first = new Date(2015, 12, 1);
  let second = new Date(2015, 12, 31);
  let third = new Date(2016, 1, 31);
  describe('to rank Date instances', () => {
    it('comparing 2019-08-27 with 2019-07-31 should return a positive value', () => {
      expect(comparators.compareDates(new Date(2019, 7, 27), new Date(2019, 6, 31)) > 0).toEqual(true);
    });
    it('comparing 2019-08-27 with 2019-07-31 should return a negative value', () => {
      expect(comparators.compareDates(new Date(2019, 6, 31), new Date(2019, 7, 27)) < 0).toEqual(true);
    });
    it('comparing 2019-08-27 with 2019-08-27 should return a zero value', () => {
      expect(comparators.compareDates(new Date(2019, 7, 27), new Date(2019, 7, 27))).toEqual(0);
    });
  });
  describe('to sort an array of Date instances', () => {
    let arrayToSort;
    beforeEach(() => {
      arrayToSort = [second, first, third];
      arrayToSort.sort(comparators.compareDates);
    });
    it('the array should be in the correct order', () => {
      expect(arrayToSort[0]).toBe(first);
      expect(arrayToSort[1]).toBe(second);
      expect(arrayToSort[2]).toBe(third);
    });
  });
  describe('to sort an array that contains something other than Date instances', () => {
    it('an error should be thrown', () => {
      expect(() => {
        let arrayToSort = [second, first, third, '1-1-2017'];
        arrayToSort.sort(comparators.compareDates);
      }).toThrow();
    });
  });
});
describe('When using the "compareNumbers" comparator', () => {
  'use strict';

  let first = -1;
  let second = Math.E;
  let third = Math.PI;
  describe('to rank numbers', () => {
    it('comparing 22 with 11 should return a positive value', () => {
      expect(comparators.compareNumbers(22, 11) > 0).toEqual(true);
    });
    it('comparing 11 with 22 should return a negative value', () => {
      expect(comparators.compareNumbers(11, 22) < 0).toEqual(true);
    });
    it('comparing 11 with 11 should return a zero value', () => {
      expect(comparators.compareNumbers(11, 11)).toEqual(0);
    });
  });
  describe('to sort an array of numbers', () => {
    let arrayToSort;
    beforeEach(() => {
      arrayToSort = [second, first, third];
      arrayToSort.sort(comparators.compareNumbers);
    });
    it('the array should be in the correct order', () => {
      expect(arrayToSort[0]).toBe(first);
      expect(arrayToSort[1]).toBe(second);
      expect(arrayToSort[2]).toBe(third);
    });
  });
  describe('to sort an array that contains something other than numbers', () => {
    it('an error should be thrown', () => {
      expect(() => {
        let arrayToSort = [second, first, third, null];
        arrayToSort.sort(comparators.compareNumbers);
      }).toThrow();
    });
  });
});
describe('When using the "compareStrings" comparator', () => {
  'use strict';

  let first = '';
  let second = 'Bye now';
  let third = 'Hi there';
  describe('to rank strings', () => {
    it('comparing "abd" with "abc" should return a positive value', () => {
      expect(comparators.compareStrings('abd', 'abc') > 0).toEqual(true);
    });
    it('comparing "abc" with "abd" should return a negative value', () => {
      expect(comparators.compareStrings('abc', 'abd') < 0).toEqual(true);
    });
    it('comparing "abc" with "abc" should return a zero value', () => {
      expect(comparators.compareStrings('abc', 'abc')).toEqual(0);
    });
  });
  describe('to sort an array of strings', () => {
    let arrayToSort;
    beforeEach(() => {
      arrayToSort = [third, first, second];
      arrayToSort.sort(comparators.compareStrings);
    });
    it('the array should be in the correct order', () => {
      expect(arrayToSort[0]).toBe(first);
      expect(arrayToSort[1]).toBe(second);
      expect(arrayToSort[2]).toBe(third);
    });
  });
  describe('to sort an array that contains something other than strings', () => {
    it('an error should be thrown', () => {
      expect(() => {
        let arrayToSort = [second, first, third, 7];
        arrayToSort.sort(comparators.compareStrings);
      }).toThrow();
    });
  });
});
describe('When using the "compareBoolean" comparator', () => {
  'use strict';

  let a = true;
  let b = false;
  let c = true;
  describe('to rank boolean values', () => {
    it('comparing "true" with "false" should return a positive value', () => {
      expect(comparators.compareBooleans(true, false) > 0).toEqual(true);
    });
    it('comparing "false" with "true" should return a negative value', () => {
      expect(comparators.compareBooleans(false, true) < 0).toEqual(true);
    });
    it('comparing "true" with "true" should return a zero value', () => {
      expect(comparators.compareBooleans(true, true)).toEqual(0);
    });
  });
  describe('to sort an array of booleans', () => {
    let arrayToSort;
    beforeEach(() => {
      arrayToSort = [a, b, c];
      arrayToSort.sort(comparators.compareBooleans);
    });
    it('the array should be in the correct order', () => {
      expect(arrayToSort[0]).toEqual(b);
      expect(arrayToSort[1]).toEqual(a);
      expect(arrayToSort[2]).toEqual(c);
    });
  });
});

},{"./../../../../collections/sorting/comparators":9}],83:[function(require,module,exports){
var CompoundMap = require('./../../../../collections/specialized/CompoundMap');

describe('When an CompoundMap is constructed', function () {
  'use strict';

  describe('with a depth of one', function () {
    var map;
    beforeEach(function () {
      map = new CompoundMap(1);
    });
    describe('and an item with one key is put into the map', function () {
      var value;
      var key;
      beforeEach(function () {
        map.put(value = 'bryan', key = 'b');
      });
      it('should have the item', function () {
        expect(map.has(key)).toEqual(true);
      });
      it('should return the value when asked', function () {
        expect(map.get(key)).toEqual(value);
      });
    });
    describe('and an item with one key is put into the map', function () {
      it('should throw an error', function () {
        expect(function () {
          map.put('bryan', 'b', 'r');
        }).toThrow();
      });
    });
  });
  describe('with a depth of two', function () {
    var map;
    beforeEach(function () {
      map = new CompoundMap(2);
    });
    describe('and an item with two keys is put into the map', function () {
      var value;
      var keyOne;
      var keyTwo;
      beforeEach(function () {
        map.put(value = 'bryan', keyOne = 'b', keyTwo = 'r');
      });
      it('should have the group', function () {
        expect(map.has(keyOne)).toEqual(true);
      });
      it('should have the item', function () {
        expect(map.has(keyOne, keyTwo)).toEqual(true);
      });
      it('should return the value when asked', function () {
        expect(map.get(keyOne, keyTwo)).toEqual(value);
      });
      describe('and another item, with the same keys, is put into the map', function () {
        var replaced;
        beforeEach(function () {
          map.put(replaced = 'brock', keyOne, keyTwo);
        });
        it('should have the item', function () {
          expect(map.has(keyOne, keyTwo)).toEqual(true);
        });
        it('should return the value when asked', function () {
          expect(map.get(keyOne, keyTwo)).toEqual(replaced);
        });
      });
      describe('and another item, with the same first key, is put into the map', function () {
        var valueB;
        var keyOneB;
        var keyTwoB;
        beforeEach(function () {
          map.put(valueB = 'bob', keyOneB = keyOne, keyTwoB = 'o');
        });
        it('should have the item', function () {
          expect(map.has(keyOneB, keyTwoB)).toEqual(true);
        });
        it('should return the value when asked', function () {
          expect(map.get(keyOneB, keyTwoB)).toEqual(valueB);
        });
        it('should still have the original item', function () {
          expect(map.has(keyOne, keyTwo)).toEqual(true);
        });
        it('should still return the original value when asked', function () {
          expect(map.get(keyOne, keyTwo)).toEqual(value);
        });
        describe('and that item is deleted', function () {
          var result;
          beforeEach(function () {
            result = map.remove(keyOneB, keyTwoB);
          });
          it('should be a successful operation', function () {
            expect(result).toEqual(true);
          });
          it('should not have the item', function () {
            expect(map.has(keyOneB, keyTwoB)).toEqual(false);
          });
          it('should still have the original item', function () {
            expect(map.has(keyOne, keyTwo)).toEqual(true);
          });
        });
        describe('and the entire group is deleted', function () {
          var result;
          beforeEach(function () {
            result = map.remove(keyOneB);
          });
          it('should be a successful operation', function () {
            expect(result).toEqual(true);
          });
          it('should not have the item', function () {
            expect(map.has(keyOneB, keyTwoB)).toEqual(false);
          });
          it('should not have the original item', function () {
            expect(map.has(keyOne, keyTwo)).toEqual(false);
          });
        });
        describe('and an attempt to delete a non-existent key is made', function () {
          var result;
          beforeEach(function () {
            result = map.remove(keyOneB, 'xxx');
          });
          it('should be a failed operation', function () {
            expect(result).toEqual(false);
          });
        });
      });
    });
    describe('and an item with one key is put into the map', function () {
      it('should throw an error', function () {
        expect(function () {
          map.put('bryan', 'b');
        }).toThrow();
      });
    });
  });
});

},{"./../../../../collections/specialized/CompoundMap":10}],84:[function(require,module,exports){
var Disposable = require('./../../../../lang/Disposable');

var DisposableStack = require('./../../../../collections/specialized/DisposableStack');

describe('When an DisposableStack is constructed', function () {
  'use strict';

  var disposeStack;
  beforeEach(function () {
    disposeStack = new DisposableStack();
  });
  it('should be disposable', function () {
    expect(disposeStack instanceof Disposable).toEqual(true);
  });
  describe('and a Disposable item is added to the stack', function () {
    var disposableOne;
    var spyOne;
    var disposeOrder;
    beforeEach(function () {
      disposeStack.push(disposableOne = Disposable.fromAction(spyOne = jasmine.createSpy('spyOne').and.callFake(function () {
        disposeOrder.push(disposableOne);
      })));
    });
    describe('and the stack is disposed', function () {
      beforeEach(function () {
        disposeOrder = [];
        disposeStack.dispose();
      });
      it('the item should be disposed', function () {
        expect(disposableOne.getIsDisposed()).toEqual(true);
      });
      it('the dispose logic should have been triggered', function () {
        expect(spyOne).toHaveBeenCalled();
      });
      describe('and another item is added to the stack', function () {
        it('should throw an error', function () {
          expect(function () {
            disposeStack.push(Disposable.fromAction(function () {}));
          }).toThrow();
        });
      });
    });
    describe('and the another item is added to the stack', function () {
      var disposableTwo;
      var spyTwo;
      beforeEach(function () {
        disposeStack.push(disposableTwo = Disposable.fromAction(spyTwo = jasmine.createSpy('spyTwo').and.callFake(function () {
          disposeOrder.push(disposableTwo);
        })));
      });
      describe('and the stack is disposed', function () {
        beforeEach(function () {
          disposeOrder = [];
          disposeStack.dispose();
        });
        it('the first item should be disposed', function () {
          expect(disposableOne.getIsDisposed()).toEqual(true);
        });
        it('the dispose logic for the first item have been triggered', function () {
          expect(spyOne).toHaveBeenCalled();
        });
        it('the second item should be disposed', function () {
          expect(disposableTwo.getIsDisposed()).toEqual(true);
        });
        it('the dispose logic for the second item have been triggered', function () {
          expect(spyTwo).toHaveBeenCalled();
        });
        it('the second item should be disposed first (per "stack" rules)', function () {
          expect(disposeOrder[0]).toBe(disposableTwo);
        });
        it('the first item should be disposed next (per "stack" rules)', function () {
          expect(disposeOrder[1]).toBe(disposableOne);
        });
      });
    });
  });
  describe('and the "pushPromise" function is used to add a DisposableItem to the stack', function () {
    var promise;
    var resolveAction;
    beforeEach(function () {
      promise = new Promise(function (resolveCallback) {
        resolveAction = resolveCallback;
      });
      DisposableStack.pushPromise(disposeStack, promise);
    });
    describe('and the promise resolves', function () {
      var spyOne;
      var disposableOne;
      beforeEach(function (done) {
        resolveAction(disposableOne = Disposable.fromAction(spyOne = jasmine.createSpy('spyOne')));
        promise.then(() => {
          done();
        });
      });
      describe('and the stack is disposed', function () {
        beforeEach(function () {
          disposeStack.dispose();
        });
        it('the dispose logic should have been triggered', function () {
          expect(spyOne).toHaveBeenCalled();
        });
      });
    });
  });
  describe('and the "pushPromise" function is used to add two DisposableItems to the stack', function () {
    var promise;
    var resolveActionOne;
    var resolveActionTwo;
    beforeEach(function () {
      promise = Promise.all([new Promise(function (resolveCallback) {
        resolveActionOne = resolveCallback;
      }), new Promise(function (resolveCallback) {
        resolveActionTwo = resolveCallback;
      })]);
      DisposableStack.pushPromise(disposeStack, promise);
    });
    describe('and the promise resolves', function () {
      var spyOne;
      var disposableOne;
      var spyTwo;
      var disposableTwo;
      var disposeOrder;
      beforeEach(function (done) {
        disposeOrder = [];
        resolveActionTwo(disposableTwo = Disposable.fromAction(spyTwo = jasmine.createSpy('spyTwo').and.callFake(function () {
          disposeOrder.push(disposableTwo);
        })));
        setTimeout(function () {
          resolveActionOne(disposableOne = Disposable.fromAction(spyOne = jasmine.createSpy('spyOne').and.callFake(function () {
            disposeOrder.push(disposableOne);
          })));
        }, 5);
        promise.then(() => {
          done();
        });
      });
      describe('and the stack is disposed', function () {
        beforeEach(function () {
          disposeStack.dispose();
        });
        it('the first item should be disposed', function () {
          expect(disposableOne.getIsDisposed()).toEqual(true);
        });
        it('the dispose logic for the first item have been triggered', function () {
          expect(spyOne).toHaveBeenCalled();
        });
        it('the second item should be disposed', function () {
          expect(disposableTwo.getIsDisposed()).toEqual(true);
        });
        it('the dispose logic for the second item have been triggered', function () {
          expect(spyTwo).toHaveBeenCalled();
        });
        it('the second item should be disposed first (per "stack" rules)', function () {
          expect(disposeOrder[0]).toBe(disposableTwo);
        });
        it('the first item should be disposed next (per "stack" rules)', function () {
          expect(disposeOrder[1]).toBe(disposableOne);
        });
      });
    });
  });
});

},{"./../../../../collections/specialized/DisposableStack":11,"./../../../../lang/Disposable":23}],85:[function(require,module,exports){
var EvictingList = require('./../../../../collections/specialized/EvictingList');

describe('When an EvictingList is constructed (with no capacity)', function () {
  'use strict';

  var list;
  beforeEach(function () {
    list = new EvictingList();
  });
  it('should be empty', function () {
    expect(list.empty()).toEqual(true);
  });
  it('should have a capacity of 10', function () {
    expect(list.getCapacity()).toEqual(10);
  });
  describe('when dumped to an array', function () {
    var array;
    beforeEach(function () {
      array = list.toArray();
    });
    it('should be empty', function () {
      expect(array.length).toEqual(0);
    });
  });
});
describe('When an EvictingList is constructed (with a capacity of 1)', function () {
  'use strict';

  var list;
  beforeEach(function () {
    list = new EvictingList(1);
  });
  it('should be empty', function () {
    expect(list.empty()).toEqual(true);
  });
  it('should have a capacity of 1', function () {
    expect(list.getCapacity()).toEqual(1);
  });
  describe('when dumped to an array', function () {
    var array;
    beforeEach(function () {
      array = list.toArray();
    });
    it('should be empty', function () {
      expect(array.length).toEqual(0);
    });
  });
  describe('when the an item is added to the list', function () {
    var a;
    beforeEach(function () {
      list.add(a = {});
    });
    it('peek should return the item', function () {
      expect(list.peek()).toBe(a);
    });
    it('should not be empty', function () {
      expect(list.empty()).toEqual(false);
    });
    describe('when dumped to an array', function () {
      var array;
      beforeEach(function () {
        array = list.toArray();
      });
      it('should contain one item', function () {
        expect(array.length).toEqual(1);
      });
      it('the first item should be the item added', function () {
        expect(array[0]).toEqual(a);
      });
    });
    describe('when a second item is added to the list', function () {
      var b;
      beforeEach(function () {
        list.add(b = {});
      });
      it('should not be empty', function () {
        expect(list.empty()).toEqual(false);
      });
      it('peek should return the second item', function () {
        expect(list.peek()).toBe(b);
      });
      describe('when dumped to an array', function () {
        var array;
        beforeEach(function () {
          array = list.toArray();
        });
        it('should contain one item', function () {
          expect(array.length).toEqual(1);
        });
        it('the first item in the array should be the most recent item', function () {
          expect(array[0]).toBe(b);
        });
      });
    });
  });
});
describe('When an EvictingList is constructed (with a capacity of 3)', function () {
  'use strict';

  var list;
  beforeEach(function () {
    list = new EvictingList(3);
  });
  it('should be empty', function () {
    expect(list.empty()).toEqual(true);
  });
  it('should have a capacity of 3', function () {
    expect(list.getCapacity()).toEqual(3);
  });
  describe('and five items are added to the list', function () {
    var a;
    var b;
    var c;
    var d;
    var e;
    beforeEach(function () {
      list.add(a = {});
      list.add(b = {});
      list.add(c = {});
      list.add(d = {});
      list.add(e = {});
    });
    it('should not be empty', function () {
      expect(list.empty()).toEqual(false);
    });
    describe('when dumped to an array', function () {
      var array;
      beforeEach(function () {
        array = list.toArray();
      });
      it('should contain three items', function () {
        expect(array.length).toEqual(3);
      });
      it('the first item should be the most recent item added', function () {
        expect(array[0]).toBe(e);
      });
      it('the second item should be the second most recent item added', function () {
        expect(array[1]).toBe(d);
      });
      it('the third item should be the third most recent item addedd', function () {
        expect(array[2]).toBe(c);
      });
    });
    describe('and 100 more items are added to the list', function () {
      var items = [];
      beforeEach(function () {
        for (var i = 0; i < 100; i++) {
          list.add(items[i] = {});
        }
      });
      describe('when dumped to an array', function () {
        var array;
        beforeEach(function () {
          array = list.toArray();
        });
        it('should contain three items', function () {
          expect(array.length).toEqual(3);
        });
        it('the first item should be the most recent item added', function () {
          expect(array[0]).toBe(items[99]);
        });
        it('the second item should be the second most recent item added', function () {
          expect(array[1]).toBe(items[98]);
        });
        it('the third item should be the third most recent item addedd', function () {
          expect(array[2]).toBe(items[97]);
        });
      });
    });
  });
});

},{"./../../../../collections/specialized/EvictingList":12}],86:[function(require,module,exports){
var EvictingMap = require('./../../../../collections/specialized/EvictingMap');

describe('When an EvictingMap is constructed (with no capacity)', function () {
  'use strict';

  var map;
  beforeEach(function () {
    map = new EvictingMap();
  });
  it('should be empty', function () {
    expect(map.empty()).toEqual(true);
  });
  it('should have a capacity of 10', function () {
    expect(map.getCapacity()).toEqual(10);
  });
});
describe('When an EvictingMap is constructed (with a capacity of 1)', function () {
  'use strict';

  var map;
  beforeEach(function () {
    map = new EvictingMap(1);
  });
  it('should be empty', function () {
    expect(map.empty()).toEqual(true);
  });
  it('should have a capacity of 1', function () {
    expect(map.getCapacity()).toEqual(1);
  });
  describe('when an item is added to the map', function () {
    var a;
    beforeEach(function () {
      a = {
        key: 'a'
      };
      map.put(a.key, a);
    });
    it('get should return the item', function () {
      expect(map.get(a.key)).toBe(a);
    });
    it('should not be empty', function () {
      expect(map.empty()).toEqual(false);
    });
    it('should have one item', function () {
      expect(map.getSize()).toEqual(1);
    });
    describe('when a second item is added to the map', function () {
      var b;
      beforeEach(function () {
        b = {
          key: 'b'
        };
        map.put(b.key, b);
      });
      it('get should return the second item', function () {
        expect(map.get(b.key)).toBe(b);
      });
      it('get should not return the first item', function () {
        expect(map.get(a.key)).toEqual(null);
      });
      it('should not be empty', function () {
        expect(map.empty()).toEqual(false);
      });
      it('should have one item', function () {
        expect(map.getSize()).toEqual(1);
      });
      describe('when a third item is added to the map', function () {
        var c;
        beforeEach(function () {
          c = {
            key: 'c'
          };
          map.put(c.key, c);
        });
        it('get should return the third item', function () {
          expect(map.get(c.key)).toBe(c);
        });
        it('get should not return the first item', function () {
          expect(map.get(a.key)).toEqual(null);
        });
        it('get should not return the second item', function () {
          expect(map.get(b.key)).toEqual(null);
        });
        it('should not be empty', function () {
          expect(map.empty()).toEqual(false);
        });
        it('should have one item', function () {
          expect(map.getSize()).toEqual(1);
        });
      });
    });
    describe('when the first item is removed from the map', function () {
      beforeEach(function () {
        map.remove('a');
      });
      it('should be empty', function () {
        expect(map.empty()).toEqual(true);
      });
      it('should have zero items', function () {
        expect(map.getSize()).toEqual(0);
      });
      describe('when the item is added to the map again', function () {
        beforeEach(function () {
          map.put(a.key, a);
        });
        it('get should return the item', function () {
          expect(map.get(a.key)).toBe(a);
        });
        it('should not be empty', function () {
          expect(map.empty()).toEqual(false);
        });
        it('should have one item', function () {
          expect(map.getSize()).toEqual(1);
        });
      });
    });
  });
});
describe('When an EvictingMap is constructed (with a capacity of 3)', function () {
  'use strict';

  var map;
  beforeEach(function () {
    map = new EvictingMap(3);
  });
  it('should be empty', function () {
    expect(map.empty()).toEqual(true);
  });
  it('should have a capacity of 3', function () {
    expect(map.getCapacity()).toEqual(3);
  });
  describe('when three items are added to the map', function () {
    var a;
    var b;
    var c;
    beforeEach(function () {
      a = {
        key: 'a'
      };
      b = {
        key: 'b'
      };
      c = {
        key: 'c'
      };
      map.put(a.key, a);
      map.put(b.key, b);
      map.put(c.key, c);
    });
    it('get "a" should return the first item', function () {
      expect(map.get(a.key)).toBe(a);
    });
    it('get "b" should return the second item', function () {
      expect(map.get(b.key)).toBe(b);
    });
    it('get "c" should return the third item', function () {
      expect(map.get(c.key)).toBe(c);
    });
    it('should not be empty', function () {
      expect(map.empty()).toEqual(false);
    });
    it('should have three items', function () {
      expect(map.getSize()).toEqual(3);
    });
    describe('when a fourth item is added to the map', function () {
      var d;
      beforeEach(function () {
        d = {
          key: 'd'
        };
        map.put(d.key, d);
      });
      it('get "a" should not return the first item', function () {
        expect(map.get(a.key)).toEqual(null);
      });
      it('get "b" should return the second item', function () {
        expect(map.get(b.key)).toBe(b);
      });
      it('get "c" should return the third item', function () {
        expect(map.get(c.key)).toBe(c);
      });
      it('get "d" should return the fourth item', function () {
        expect(map.get(d.key)).toBe(d);
      });
      it('should not be empty', function () {
        expect(map.empty()).toEqual(false);
      });
      it('should have three items', function () {
        expect(map.getSize()).toEqual(3);
      });
      describe('after getting item "b" from map', function () {
        beforeEach(function () {
          map.get(b.key);
        });
        describe('when a fifth item is added to the list', function () {
          var e;
          beforeEach(function () {
            e = {
              key: 'e'
            };
            map.put(e.key, e);
          });
          it('get "a" should not return the first item', function () {
            expect(map.get(a.key)).toEqual(null);
          });
          it('get "b" should return the second item', function () {
            expect(map.get(b.key)).toBe(b);
          });
          it('get "c" should not return the third item', function () {
            expect(map.get(c.key)).toEqual(null);
          });
          it('get "d" should return the fourth item', function () {
            expect(map.get(d.key)).toBe(d);
          });
          it('get "e" should return the fifth item', function () {
            expect(map.get(e.key)).toBe(e);
          });
          it('should not be empty', function () {
            expect(map.empty()).toEqual(false);
          });
          it('should have three items', function () {
            expect(map.getSize()).toEqual(3);
          });
        });
      });
    });
  });
});
describe('When an EvictingMap is constructed', function () {
  'use strict';

  var map;
  beforeEach(function () {
    map = new EvictingMap(3);
  });
  describe('and used in a write-read-write pattern', function () {
    var a;
    var b;
    var c;
    var x;
    var y;
    beforeEach(function () {
      a = {
        key: 'a'
      };
      b = {
        key: 'b'
      };
      c = {
        key: 'c'
      };
      x = {
        key: 'x'
      };
      y = {
        key: 'y'
      };
      map.put(a.key, a);
      map.put(b.key, b);
      map.put(c.key, c);
      map.get(c.key);
      map.get(a.key);
      map.get(c.key);
      map.put(a.key, a);
      map.put(b.key, b);
      map.put(c.key, c);
      map.put(x.key, x);
      map.put(y.key, y);
    });
    it('get "a" should not return the first item', function () {
      expect(map.get(a.key)).toEqual(null);
    });
    it('get "b" should not return the second item', function () {
      expect(map.get(b.key)).toEqual(null);
    });
    it('get "c" should return the third item', function () {
      expect(map.get(c.key)).toBe(c);
    });
    it('get "x" should return the fourth item', function () {
      expect(map.get(x.key)).toBe(x);
    });
    it('get "y" should return the fourth item', function () {
      expect(map.get(y.key)).toBe(y);
    });
    it('should not be empty', function () {
      expect(map.empty()).toEqual(false);
    });
    it('should have three items', function () {
      expect(map.getSize()).toEqual(3);
    });
  });
});

},{"./../../../../collections/specialized/EvictingMap":13}],87:[function(require,module,exports){
var PriorityQueue = require('./../../../../collections/specialized/PriorityQueue');

describe('When a Queue is constructed, using a "ladies first" comparator', function () {
  'use strict';

  var queue;

  var comparator = function (a, b) {
    var aLady = a.lady ? -1 : 0;
    var bLady = b.lady ? -1 : 0;
    var result = aLady - bLady;

    if (result === 0) {
      result = a.name.localeCompare(b.name);
    }

    return result;
  };

  beforeEach(function () {
    queue = new PriorityQueue(comparator);
  });
  it('should be empty', function () {
    expect(queue.empty()).toEqual(true);
  });
  it('should throw if "peek" is called', function () {
    expect(function () {
      queue.peek();
    }).toThrow(new Error('Queue is empty'));
  });
  it('should throw if "dequeue" is called', function () {
    expect(function () {
      queue.peek();
    }).toThrow(new Error('Queue is empty'));
  });
  describe('and an three objects are enqueued: Kim, Bryan, and Erica', function () {
    var kim, bryan, erica;
    beforeEach(function () {
      queue.enqueue(kim = {
        name: 'kim',
        lady: true
      });
      queue.enqueue(bryan = {
        name: 'bryan',
        lady: false
      });
      queue.enqueue(erica = {
        name: 'erica',
        lady: true
      });
    });
    it('should not be empty', function () {
      expect(queue.empty()).toEqual(false);
    });
    describe('and we peek at the top of the queue', function () {
      var peek;
      beforeEach(function () {
        peek = queue.peek();
      });
      it('the peek result should be erica', function () {
        expect(peek).toBe(erica);
      });
      it('should not be empty', function () {
        expect(queue.empty()).toEqual(false);
      });
    });
    describe('and an object is dequeued', function () {
      var dequeue;
      beforeEach(function () {
        dequeue = queue.dequeue();
      });
      it('the dequeue result should be erica', function () {
        expect(dequeue).toBe(erica);
      });
      it('should not be empty', function () {
        expect(queue.empty()).toEqual(false);
      });
      describe('and an second object is dequeued', function () {
        var dequeue;
        beforeEach(function () {
          dequeue = queue.dequeue();
        });
        it('the dequeue result should be kim', function () {
          expect(dequeue).toBe(kim);
        });
        it('should not be empty', function () {
          expect(queue.empty()).toEqual(false);
        });
        describe('and a third object is dequeued', function () {
          var dequeue;
          beforeEach(function () {
            dequeue = queue.dequeue();
          });
          it('the dequeue result should be bryan', function () {
            expect(dequeue).toBe(bryan);
          });
          it('should be empty', function () {
            expect(queue.empty()).toEqual(true);
          });
        });
      });
    });
    describe('and the queue is exported to an array', function () {
      var a;
      beforeEach(function () {
        a = queue.toArray();
      });
      it('should return an array with three items', function () {
        expect(a.length).toEqual(3);
      });
      it('the first item should be erica', function () {
        expect(a[0]).toBe(erica);
      });
      it('the second item should be kim', function () {
        expect(a[1]).toBe(kim);
      });
      it('the third item should be bryan', function () {
        expect(a[2]).toBe(bryan);
      });
      it('should not be empty', function () {
        expect(queue.empty()).toEqual(false);
      });
    });
    describe('and the queue is scanned', function () {
      var spy;
      beforeEach(function () {
        spy = jasmine.createSpy();
        queue.scan(spy);
      });
      it('should call the delegate one time for each item in the queue', function () {
        expect(spy.calls.count()).toEqual(3);
      });
      it('should pass erica to the delegate first', function () {
        expect(spy.calls.argsFor(0)[0]).toBe(erica);
      });
      it('should pass kim to the delegate second', function () {
        expect(spy.calls.argsFor(1)[0]).toBe(kim);
      });
      it('should pass bryan to the delegate thrid', function () {
        expect(spy.calls.argsFor(2)[0]).toBe(bryan);
      });
      it('should not be empty', function () {
        expect(queue.empty()).toEqual(false);
      });
    });
  });
});
describe('When a Queue is constructed, using a simple (ascending) numeric comparator', function () {
  'use strict';

  var queue;

  var comparator = function (a, b) {
    return a - b;
  };

  beforeEach(function () {
    queue = new PriorityQueue(comparator);
  });
  describe('and the following values are enqueued: 3, 2, and 1', function () {
    beforeEach(function () {
      queue.enqueue(3);
      queue.enqueue(2);
      queue.enqueue(1);
    });
    describe('and all items are dequeued', function () {
      var a, b, c;
      beforeEach(function () {
        a = queue.dequeue();
        b = queue.dequeue();
        c = queue.dequeue();
      });
      it('the dequeued items should be ordered property', function () {
        expect(a).toEqual(1);
        expect(b).toEqual(2);
        expect(c).toEqual(3);
      });
    });
  });
  describe('and the following values are enqueued: 1, 2, and 3', function () {
    beforeEach(function () {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);
    });
    describe('and all items are dequeued', function () {
      var a, b, c;
      beforeEach(function () {
        a = queue.dequeue();
        b = queue.dequeue();
        c = queue.dequeue();
      });
      it('the dequeued items should be ordered property', function () {
        expect(a).toEqual(1);
        expect(b).toEqual(2);
        expect(c).toEqual(3);
      });
    });
  });
  describe('and the following values are enqueued: 2, 3, and 1', function () {
    beforeEach(function () {
      queue.enqueue(2);
      queue.enqueue(3);
      queue.enqueue(1);
    });
    describe('and all items are dequeued', function () {
      var a, b, c;
      beforeEach(function () {
        a = queue.dequeue();
        b = queue.dequeue();
        c = queue.dequeue();
      });
      it('the dequeued items should be ordered property', function () {
        expect(a).toEqual(1);
        expect(b).toEqual(2);
        expect(c).toEqual(3);
      });
    });
  });
  describe('and the following values are enqueued: 3, 1, 2', function () {
    beforeEach(function () {
      queue.enqueue(3);
      queue.enqueue(1);
      queue.enqueue(2);
    });
    describe('and all items are dequeued', function () {
      var a, b, c;
      beforeEach(function () {
        a = queue.dequeue();
        b = queue.dequeue();
        c = queue.dequeue();
      });
      it('the dequeued items should be ordered property', function () {
        expect(a).toEqual(1);
        expect(b).toEqual(2);
        expect(c).toEqual(3);
      });
    });
  });
  describe('and the following values are enqueued: 3, 1, 2', function () {
    beforeEach(function () {
      queue.enqueue(8);
      queue.enqueue(7);
      queue.enqueue(9);
      queue.enqueue(3);
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(4);
      queue.enqueue(6);
      queue.enqueue(5);
    });
    describe('and all items are dequeued', function () {
      var a, b, c, d, e, f, g, h, i;
      beforeEach(function () {
        a = queue.dequeue();
        b = queue.dequeue();
        c = queue.dequeue();
        d = queue.dequeue();
        e = queue.dequeue();
        f = queue.dequeue();
        g = queue.dequeue();
        h = queue.dequeue();
        i = queue.dequeue();
      });
      it('the dequeued items should be ordered property', function () {
        expect(a).toEqual(1);
        expect(b).toEqual(2);
        expect(c).toEqual(3);
        expect(d).toEqual(4);
        expect(e).toEqual(5);
        expect(f).toEqual(6);
        expect(g).toEqual(7);
        expect(h).toEqual(8);
        expect(i).toEqual(9);
      });
    });
  });
});

},{"./../../../../collections/specialized/PriorityQueue":14}],88:[function(require,module,exports){
var TimeMap = require('./../../../../collections/specialized/TimeMap');

describe('When an TimeMap is constructed (with a 10 millisecond time to live)', function () {
  'use strict';

  var map;
  beforeEach(function () {
    map = new TimeMap(10);
  });
  describe('and an item is added to the map', function () {
    var key;
    var item;
    beforeEach(function () {
      map.set(key = 'a', item = {});
    });
    it('should contain the key', function () {
      expect(map.has(key)).toEqual(true);
    });
    it('should return the original value', function () {
      expect(map.get(key)).toBe(item);
    });
    describe('and 15 milliseconds elapses', function () {
      beforeEach(function (done) {
        setTimeout(function () {
          done();
        }, 15);
      });
      it('should not contain the key', function () {
        expect(map.has(key)).toEqual(false);
      });
      it('should not return the original value', function () {
        expect(map.get(key)).toEqual(null);
      });
    });
  });
});

},{"./../../../../collections/specialized/TimeMap":15}],89:[function(require,module,exports){
var CommandHandler = require('./../../../commands/CommandHandler');

describe('When a CommandHandler is created from a function', function () {
  'use strict';

  var commandHandler;
  var spy;
  var result;
  beforeEach(function () {
    commandHandler = CommandHandler.fromFunction(spy = jasmine.createSpy('spy').and.returnValue(result = 123));
  });
  it('returns a CommandHandler instance', function () {
    expect(commandHandler instanceof CommandHandler).toEqual(true);
  });
  describe('and the command is executed', function () {
    var commandData;
    var commandResult;
    beforeEach(function () {
      commandResult = commandHandler.process(commandData = {});
    });
    it('should invoke the wrapped function', function () {
      expect(spy).toHaveBeenCalledWith(commandData);
    });
    it('should return the wrapped function\'s result', function () {
      expect(commandResult).toEqual(result);
    });
  });
  describe('and the command processor is converted to a function', function () {
    var commandFunction;
    beforeEach(function () {
      commandFunction = CommandHandler.toFunction(commandHandler);
    });
    it('returns a function', function () {
      expect(typeof commandFunction).toEqual('function');
    });
    describe('and the converted function is invoked', function () {
      var commandData;
      var commandResult;
      beforeEach(function () {
        commandResult = commandFunction(commandData = {});
      });
      it('should invoke the wrapped function', function () {
        expect(spy).toHaveBeenCalledWith(commandData);
      });
      it('should return the wrapped function\'s result', function () {
        expect(commandResult).toEqual(result);
      });
    });
  });
});

},{"./../../../commands/CommandHandler":16}],90:[function(require,module,exports){
var CommandHandler = require('./../../../commands/CommandHandler');

var CompositeCommandHandler = require('./../../../commands/CompositeCommandHandler');

describe('When a CompositeCommandHandler is created', function () {
  'use strict';

  var commandHandler;
  var spyOne;
  var spyTwo;
  var resultOne;
  var resultTwo;
  beforeEach(function () {
    resultOne = true;
    resultTwo = true;
    commandHandler = new CompositeCommandHandler(CommandHandler.fromFunction(spyOne = jasmine.createSpy('spyOne').and.callFake(function () {
      return resultOne;
    })), CommandHandler.fromFunction(spyTwo = jasmine.createSpy('spyTwo').and.callFake(function () {
      return resultTwo;
    })));
  });
  describe('and the command is executed', function () {
    var commandData;
    var commandResult;
    beforeEach(function () {
      commandResult = commandHandler.process(commandData = {});
    });
    it('should invoke the wrapped functions', function () {
      expect(spyOne).toHaveBeenCalledWith(commandData);
      expect(spyTwo).toHaveBeenCalledWith(commandData);
    });
  });
  describe('and the command is executed, but the first command fails', function () {
    var commandData;
    var commandResult;
    beforeEach(function () {
      resultOne = false;
      resultTwo = false;
      commandResult = commandHandler.process(commandData = {});
    });
    it('should invoke the first command', function () {
      expect(spyOne).toHaveBeenCalledWith(commandData);
    });
    it('should not invoke the first command', function () {
      expect(spyTwo).not.toHaveBeenCalledWith(commandData);
    });
  });
});

},{"./../../../commands/CommandHandler":16,"./../../../commands/CompositeCommandHandler":17}],91:[function(require,module,exports){
var CommandHandler = require('./../../../commands/CommandHandler');

var MappedCommandHandler = require('./../../../commands/MappedCommandHandler');

describe('When a MappedCommandHandler is created with two mapped commands', function () {
  'use strict';

  var commandHandler;
  var spyOne;
  var spyTwo;
  var selectorOne;
  var selectorTwo;
  var resultOne;
  var resultTwo;
  beforeEach(function () {
    selectorOne = 'one';
    selectorTwo = 'two';
    resultOne = 'a';
    resultTwo = 'b';
    commandHandler = new MappedCommandHandler(function (data) {
      return data.commandType || null;
    });
    commandHandler.addCommandHandler(selectorOne, CommandHandler.fromFunction(spyOne = jasmine.createSpy('spyOne').and.callFake(function () {
      return resultOne;
    })));
    commandHandler.addCommandHandler(selectorTwo, CommandHandler.fromFunction(spyTwo = jasmine.createSpy('spyTwo').and.callFake(function () {
      return resultTwo;
    })));
  });
  describe('and the command is process with data for the first handler', function () {
    var commandData;
    var commandResult;
    beforeEach(function () {
      commandResult = commandHandler.process(commandData = {
        commandType: selectorOne
      });
    });
    it('should invoke wrapped function for the first handler', function () {
      expect(spyOne).toHaveBeenCalledWith(commandData);
    });
    it('should return the result from the first handler', function () {
      expect(commandResult).toEqual(resultOne);
    });
    it('should not invoke wrapped function for the secoond handler', function () {
      expect(spyTwo).not.toHaveBeenCalledWith(commandData);
    });
  });
  describe('and the command is process with data for the second handler', function () {
    var commandData;
    var commandResult;
    beforeEach(function () {
      commandResult = commandHandler.process(commandData = {
        commandType: selectorTwo
      });
    });
    it('should invoke wrapped function for the second handler', function () {
      expect(spyTwo).toHaveBeenCalledWith(commandData);
    });
    it('should return the result from the second handler', function () {
      expect(commandResult).toEqual(resultTwo);
    });
    it('should not invoke wrapped function for the first handler', function () {
      expect(spyOne).not.toHaveBeenCalledWith(commandData);
    });
  });
});

},{"./../../../commands/CommandHandler":16,"./../../../commands/MappedCommandHandler":18}],92:[function(require,module,exports){
var AdHoc = require('./../../../lang/AdHoc');

describe('When wrapping an object in an ad hoc serialization container', function () {
  'use strict';

  var data;
  var adHoc;
  beforeEach(function () {
    adHoc = new AdHoc(data = {
      a: 1,
      b: 'two'
    });
  });
  it('should contain the wrapped object', function () {
    expect(adHoc.data).toBe(data);
  });
  describe('and container is serialized', function () {
    var serialized;
    beforeEach(function () {
      serialized = adHoc.toJSON();
    });
    it('should be an escaped string', function () {
      expect(serialized).toEqual('{\"a\":1,\"b\":\"two\"}');
    });
    describe('and container is deserialized', function () {
      var deserialized;
      beforeEach(function () {
        deserialized = AdHoc.parse(serialized);
      });
      it('should be an ad hoc container', function () {
        expect(deserialized instanceof AdHoc).toEqual(true);
      });
      it('should contain a clone of the original data', function () {
        expect(deserialized.data.a).toEqual(data.a);
        expect(deserialized.data.b).toEqual(data.b);
      });
    });
  });
});

},{"./../../../lang/AdHoc":19}],93:[function(require,module,exports){
var Day = require('./../../../lang/Day');

describe('When "2017-08-31 is parsed as a Day', function () {
  'use strict';

  var day;
  beforeEach(function () {
    day = Day.parse('2017-08-31');
  });
  it('the year should be 2017', function () {
    expect(day.year).toEqual(2017);
  });
  it('the month should be 8', function () {
    expect(day.month).toEqual(8);
  });
  it('the day should be 31', function () {
    expect(day.day).toEqual(31);
  });
  describe('and the Day instance is formatted', function () {
    it('should output "2017-08-31"', function () {
      expect(day.format()).toEqual('2017-08-31');
    });
  });
});
describe('When converting a Date (2017-11-16 at 17:40:01.002 local) to a Day', function () {
  'use strict';

  var date;
  var day;
  beforeEach(function () {
    day = Day.fromDate(date = new Date(2017, 10, 16, 17, 40, 1, 2));
  });
  it('the year should be 2017', function () {
    expect(day.year).toEqual(2017);
  });
  it('the month should be 11', function () {
    expect(day.month).toEqual(11);
  });
  it('the day should be 16', function () {
    expect(day.day).toEqual(16);
  });
});
describe('When converting a Date (2017-11-16 at 23:40:01.002 local) to a UTC Day', function () {
  'use strict';

  var date;
  var day;
  beforeEach(function () {
    day = Day.fromDateUtc(date = new Date(2017, 10, 16, 23, 40, 1, 2));
  });
  it('the year should be correct', function () {
    expect(day.year).toEqual(date.getUTCFullYear());
  });
  it('the month should be correct', function () {
    expect(day.month).toEqual(date.getUTCMonth() + 1);
  });
  it('the day should be correct', function () {
    expect(day.day).toEqual(date.getUTCDate());
  });
});
describe('When an invalid string is parsed as a Day', function () {
  function expectError(value) {
    expect(function () {
      Day.parse(value);
    }).toThrow();
  }

  it('an error should be thrown parsing a null value', function () {
    expectError(null);
  });
  it('an error should be thrown parsing a undefined value', function () {
    expectError(null);
  });
  it('an error should be thrown parsing a Date instance', function () {
    expectError(new Date());
  });
  it('an error should be thrown parsing an object', function () {
    expectError({});
  });
  it('an error should be thrown parsing an number', function () {
    expectError(new Date().getTime());
  });
  it('an should be thrown when using 13 months', function () {
    expectError('2017-13-01');
  });
  it('an should be thrown when using 32 days in January', function () {
    expectError('2017-01-32');
  });
  it('an should be thrown when using 30 days in February', function () {
    expectError('2017-02-30');
  });
  it('an should be thrown when using 32 days in March', function () {
    expectError('2017-03-32');
  });
  it('an should be thrown when using 31 days in April', function () {
    expectError('2017-04-31');
  });
  it('an should be thrown when using 32 days in May', function () {
    expectError('2017-05-32');
  });
  it('an should be thrown when using 31 days in June', function () {
    expectError('2017-06-31');
  });
  it('an should be thrown when using 32 days in July', function () {
    expectError('2017-07-32');
  });
  it('an should be thrown when using 32 days in August', function () {
    expectError('2017-08-32');
  });
  it('an should be thrown when using 31 days in September', function () {
    expectError('2017-02-31');
  });
  it('an should be thrown when using 32 days in October', function () {
    expectError('2017-10-32');
  });
  it('an should be thrown when using 31 days in November', function () {
    expectError('2017-11-31');
  });
  it('an should be thrown when using 32 days in December', function () {
    expectError('2017-12-32');
  });
});
describe('When checking to see if a Day is valid', function () {
  'use strict';

  it('should consider Jan 1, 2017 to be valid', function () {
    expect(Day.validate(2017, 1, 1)).toEqual(true);
  });
  it('should consider Dec 31, 2017 to be valid', function () {
    expect(Day.validate(2017, 12, 31)).toEqual(true);
  });
  it('should not consider Feb 29, 2017 to be valid', function () {
    expect(Day.validate(2017, 2, 29)).toEqual(false);
  });
  it('should not consider Feb 29, 2018 to be valid', function () {
    expect(Day.validate(2018, 2, 29)).toEqual(false);
  });
  it('should not consider Feb 29, 2019 to be valid', function () {
    expect(Day.validate(2019, 2, 29)).toEqual(false);
  });
  it('should consider Feb 29, 2020 to be valid', function () {
    expect(Day.validate(2020, 2, 29)).toEqual(true);
  });
});
describe('When adding days to a Day', function () {
  'use strict';

  it('should return January 2, 2017 when adding 1 day to January 1, 2017', function () {
    const now = new Day(2017, 1, 1);
    const then = now.addDays(1);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(1);
    expect(then.day).toEqual(2);
  });
  it('should return March 1, 2017 when adding 1 day to Feb 28, 2017', function () {
    const now = new Day(2017, 2, 28);
    const then = now.addDays(1);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(3);
    expect(then.day).toEqual(1);
  });
  it('should return Feb 29, 2020 when adding 1 day Feb 28, 2020', function () {
    const now = new Day(2020, 2, 28);
    const then = now.addDays(1);
    expect(then.year).toEqual(2020);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(29);
  });
  it('should return Aug 18, 2018 when adding 400 days to Jul 14, 2017', function () {
    const now = new Day(2017, 7, 14);
    const then = now.addDays(400);
    expect(then.year).toEqual(2018);
    expect(then.month).toEqual(8);
    expect(then.day).toEqual(18);
  });
  it('should return Aug 18, 2017 when subtracting 1 day from Aug 19, 2017 (using inverse)', function () {
    const now = new Day(2017, 8, 19);
    const then = now.subtractDays(1);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(8);
    expect(then.day).toEqual(18);
  });
  it('should return Aug 18, 2017 when adding 1 "inverse" day to Aug 19, 2017', function () {
    const now = new Day(2017, 8, 19);
    const then = now.addDays(1, true);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(8);
    expect(then.day).toEqual(18);
  });
  it('should return Aug 18, 2017 when adding -1 day to Aug 19, 2017', function () {
    const now = new Day(2017, 8, 19);
    const then = now.addDays(-1);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(8);
    expect(then.day).toEqual(18);
  });
  it('should return Jul 30, 2017 when subtracting 2 days from Aug 1, 2017', function () {
    const now = new Day(2017, 8, 1);
    const then = now.addDays(2, true);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(7);
    expect(then.day).toEqual(30);
  });
  it('should return Dec 31, 2017 when subtracting 2 days from Jan 10, 2018', function () {
    const now = new Day(2018, 1, 10);
    const then = now.addDays(10, true);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(12);
    expect(then.day).toEqual(31);
  });
  it('should return Feb 29, 2020 when subtracting 1 day from Mar 1, 2020', function () {
    const now = new Day(2020, 3, 1);
    const then = now.addDays(1, true);
    expect(then.year).toEqual(2020);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(29);
  });
  it('should return Mar 1, 2020 when adding 0 days from Mar 1, 2020', function () {
    const now = new Day(2020, 3, 1);
    const then = now.addDays(0);
    expect(then.year).toEqual(2020);
    expect(then.month).toEqual(3);
    expect(then.day).toEqual(1);
  });
});
describe('When adding months to a Day', function () {
  'use strict';

  it('should return January 2, 2017 when adding 13 months to December 2, 2015', function () {
    const now = new Day(2015, 12, 2);
    const then = now.addMonths(13);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(1);
    expect(then.day).toEqual(2);
  });
  it('should return December 2, 2015 when subtracting 13 months from January 2, 2017', function () {
    const now = new Day(2017, 1, 2);
    const then = now.subtractMonths(13);
    expect(then.year).toEqual(2015);
    expect(then.month).toEqual(12);
    expect(then.day).toEqual(2);
  });
  it('should return February 28, 2018 when adding a month to January 30, 2018', function () {
    const now = new Day(2018, 1, 30);
    const then = now.addMonths(1);
    expect(then.year).toEqual(2018);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(28);
  });
  it('should return February 28, 2018 when subtracting a month to March 29, 2018', function () {
    const now = new Day(2018, 3, 29);
    const then = now.subtractMonths(1);
    expect(then.year).toEqual(2018);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(28);
  });
});
describe('When adding years to a Day', function () {
  'use strict';

  it('should return January 2, 2017 when adding 3 years to January 2, 2014', function () {
    const now = new Day(2014, 1, 2);
    const then = now.addYears(3);
    expect(then.year).toEqual(2017);
    expect(then.month).toEqual(1);
    expect(then.day).toEqual(2);
  });
  it('should return January 2, 2014 when subtracting 3 years to January 2, 2017', function () {
    const now = new Day(2017, 1, 2);
    const then = now.subtractYears(3);
    expect(then.year).toEqual(2014);
    expect(then.month).toEqual(1);
    expect(then.day).toEqual(2);
  });
  it('should return February 29, 2020 when adding 4 years to February 29, 2016', function () {
    const now = new Day(2016, 2, 29);
    const then = now.addYears(4);
    expect(then.year).toEqual(2020);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(29);
  });
  it('should return February 29, 2016 when subtracting 4 years to February 29, 2020', function () {
    const now = new Day(2020, 2, 29);
    const then = now.subtractYears(4);
    expect(then.year).toEqual(2016);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(29);
  });
  it('should return February 28, 2019 when adding 3 years to February 29, 2016', function () {
    const now = new Day(2016, 2, 29);
    const then = now.addYears(3);
    expect(then.year).toEqual(2019);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(28);
  });
  it('should return February 28, 2016 when subtracting 3 years to February 28, 2019', function () {
    const now = new Day(2019, 2, 28);
    const then = now.subtractYears(3);
    expect(then.year).toEqual(2016);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(28);
  });
  it('should return February 28, 2019 when subtracting 1 years to February 29, 2020', function () {
    const now = new Day(2020, 2, 29);
    const then = now.subtractYears(1);
    expect(then.year).toEqual(2019);
    expect(then.month).toEqual(2);
    expect(then.day).toEqual(28);
  });
});
describe('When "1900-01-01 is parsed as a Day', function () {
  'use strict';

  var day;
  beforeEach(function () {
    day = Day.parse('1900-01-01');
  });
  it('the year should be 1900', function () {
    expect(day.year).toEqual(1900);
  });
  it('the month should be 1', function () {
    expect(day.month).toEqual(1);
  });
  it('the day should be 1', function () {
    expect(day.day).toEqual(1);
  });
  describe('and 41635 days are added', function () {
    var future;
    beforeEach(function () {
      future = day.addDays(41635);
    });
    it('the year should be 2013', function () {
      expect(future.year).toEqual(2013);
    });
    it('the month should be 12', function () {
      expect(future.month).toEqual(12);
    });
    it('the day should be 29', function () {
      expect(future.day).toEqual(29);
    });
  });
});
describe('When comparing days', function () {
  it('The day "2017-07-18" should be before "2017-07-19"', function () {
    expect(Day.parse('2017-07-18').getIsBefore(Day.parse('2017-07-19'))).toEqual(true);
  });
  it('The day "2017-07-18" should be before "2017-08-18"', function () {
    expect(Day.parse('2017-07-18').getIsBefore(Day.parse('2017-08-18'))).toEqual(true);
  });
  it('The day "2017-07-18" should be before "2018-07-18"', function () {
    expect(Day.parse('2017-07-18').getIsBefore(Day.parse('2018-07-18'))).toEqual(true);
  });
  it('The day "2017-07-18" should not be after "2017-07-19"', function () {
    expect(Day.parse('2017-07-18').getIsAfter(Day.parse('2017-07-19'))).toEqual(false);
  });
  it('The day "2017-07-18" should not be after "2017-08-18"', function () {
    expect(Day.parse('2017-07-18').getIsAfter(Day.parse('2017-08-18'))).toEqual(false);
  });
  it('The day "2017-07-18" should bit be afte "2018-07-18"', function () {
    expect(Day.parse('2017-07-18').getIsAfter(Day.parse('2018-07-18'))).toEqual(false);
  });
  it('The day "2017-07-18" should not be before "2017-07-17"', function () {
    expect(Day.parse('2017-07-18').getIsBefore(Day.parse('2017-07-17'))).toEqual(false);
  });
  it('The day "2017-07-18" should not be before "2017-06-18"', function () {
    expect(Day.parse('2017-07-18').getIsBefore(Day.parse('2017-06-18'))).toEqual(false);
  });
  it('The day "2017-07-18" should not be before "2016-07-18"', function () {
    expect(Day.parse('2017-07-18').getIsBefore(Day.parse('2016-07-18'))).toEqual(false);
  });
  it('The day "2017-07-18" should be after "2017-07-17"', function () {
    expect(Day.parse('2017-07-18').getIsAfter(Day.parse('2017-07-17'))).toEqual(true);
  });
  it('The day "2017-07-18" should be after "2017-06-18"', function () {
    expect(Day.parse('2017-07-18').getIsAfter(Day.parse('2017-06-18'))).toEqual(true);
  });
  it('The day "2017-07-18" should be after "2016-07-18"', function () {
    expect(Day.parse('2017-07-18').getIsAfter(Day.parse('2016-07-18'))).toEqual(true);
  });
});
describe('When checking a days containment in a range of days', function () {
  var day;
  beforeEach(function () {
    day = new Day(2018, 3, 11);
  });
  it('should return true when the date is between the range boundaries', function () {
    expect(day.getIsContained(new Day(2018, 3, 10), new Day(2018, 3, 12))).toEqual(true);
  });
  it('should return true when the date is on the beginning boundary of the range', function () {
    expect(day.getIsContained(new Day(2018, 3, 11), new Day(2018, 3, 12))).toEqual(true);
  });
  it('should return true when the date is on the end boundary of the range', function () {
    expect(day.getIsContained(new Day(2018, 3, 10), new Day(2018, 3, 11))).toEqual(true);
  });
  it('should return true when no end boundary is specified, but the date is after the beginning boundary', function () {
    expect(day.getIsContained(new Day(2018, 3, 10))).toEqual(true);
  });
  it('should return true when no beginning boundary is specified, but the date is before the end boundary', function () {
    expect(day.getIsContained(null, new Day(2018, 3, 12))).toEqual(true);
  });
  it('should return true when no end boundary is specified, but the date is on the beginning boundary', function () {
    expect(day.getIsContained(new Day(2018, 3, 11))).toEqual(true);
  });
  it('should return true when no beginning boundary is specified, but the date is on the end boundary', function () {
    expect(day.getIsContained(null, new Day(2018, 3, 11))).toEqual(true);
  });
  it('should return false when the date is after range boundaries', function () {
    expect(day.getIsContained(new Day(2018, 3, 8), new Day(2018, 3, 10))).toEqual(false);
  });
  it('should return false when the date is after before boundaries', function () {
    expect(day.getIsContained(new Day(2018, 3, 12), new Day(2018, 3, 14))).toEqual(false);
  });
  it('should return false when no end boundary is specified, but the date is before the beginning boundary', function () {
    expect(day.getIsContained(new Day(2018, 3, 12))).toEqual(false);
  });
  it('should return false when no beginning boundary is specified, but the date is after the end boundary', function () {
    expect(day.getIsContained(null, new Day(2018, 3, 10))).toEqual(false);
  });
  it('should return false when the range is invalid', function () {
    expect(day.getIsContained(new Day(2018, 3, 12), new Day(2018, 3, 10))).toEqual(false);
  });
});
describe('When cloning a day', function () {
  var source;
  var clone;
  beforeEach(function () {
    source = new Day(2018, 3, 11);
    clone = Day.clone(source);
  });
  it('the cloned instance should not be the same as the source instance', function () {
    expect(clone).not.toBe(source);
  });
  it('the cloned year should be equal to the source year', function () {
    expect(clone.year).toEqual(source.year);
  });
  it('the cloned month should be equal to the source month', function () {
    expect(clone.year).toEqual(source.year);
  });
  it('the cloned day should be equal to the source day', function () {
    expect(clone.year).toEqual(source.year);
  });
  it('the cloned instance should equal the source instance', function () {
    expect(source.getIsEqual(clone)).toEqual(true);
  });
});
describe('When getting start of the month', function () {
  it('for 2018-02-28 should be 2018-02-01', function () {
    expect(new Day(2018, 2, 28).getStartOfMonth().getIsEqual(new Day(2018, 2, 1))).toEqual(true);
  });
  it('for 2018-03-30 should be 2018-03-01', function () {
    expect(new Day(2018, 3, 30).getStartOfMonth().getIsEqual(new Day(2018, 3, 1))).toEqual(true);
  });
  it('should not return the same object', function () {
    const d = new Day(2018, 2, 1);
    expect(d.getStartOfMonth()).not.toBe(d);
  });
});
describe('When getting end of the month', function () {
  it('for 2018-02-28 should be 2018-02-28', function () {
    expect(new Day(2018, 2, 28).getEndOfMonth().getIsEqual(new Day(2018, 2, 28))).toEqual(true);
  });
  it('for 2018-03-30 should be 2018-03-31', function () {
    expect(new Day(2018, 3, 30).getEndOfMonth().getIsEqual(new Day(2018, 3, 31))).toEqual(true);
  });
  it('should not return the same object', function () {
    const d = new Day(2018, 2, 28);
    expect(d.getEndOfMonth()).not.toBe(d);
  });
});

},{"./../../../lang/Day":21}],94:[function(require,module,exports){
var Decimal = require('./../../../lang/Decimal');

describe('When adding values that cause floating point problems (e.g. 1.1 + 2.2 != 3.3)', function () {
  'use strict';

  var a;
  var b;
  var c;
  beforeEach(function () {
    a = new Decimal(1.1);
    b = new Decimal(2.2);
    c = a.add(b);
  });
  describe('and exported to a floating point value', function () {
    var f;
    beforeEach(function () {
      f = c.toFloat();
    });
    it('should sum to 3.3 (not 3.3000000000000003)', function () {
      expect(f).toEqual(3.3);
    });
  });
});
describe('When working with values that loss of precision occurs with floating point math (e.g. 100 trillion plus one third)', function () {
  'use strict';

  var a;
  var b;
  var c;
  beforeEach(function () {
    a = new Decimal(100000000000000);
    b = new Decimal(1 / 8);
    c = a.add(b);
  });
  describe('and exported to a fixed string', function () {
    var f;
    beforeEach(function () {
      f = c.toFixed();
    });
    it('should maintain precision', function () {
      expect(f).toEqual("100000000000000.125");
    });
  });
});
describe('When accessing the "Zero" singleton', function () {
  'use strict';

  var zero;
  beforeEach(function () {
    zero = Decimal.ZERO;
  });
  it('should not be positive', function () {
    expect(zero.getIsPositive()).toEqual(false);
  });
  it('should not be negative', function () {
    expect(zero.getIsNegative()).toEqual(false);
  });
  it('should be zero', function () {
    expect(zero.getIsZero()).toEqual(true);
  });
  it('should approximate zero', function () {
    expect(zero.getIsZero(true)).toEqual(true);
  });
  it('the floating point export should equal zero', function () {
    expect(zero.toFloat()).toEqual(0);
  });
  it('the fixed export should equal "0"', function () {
    expect(zero.toFixed()).toEqual('0');
  });
});
describe('When instantiating a Decimal', function () {
  'use strict';

  describe('from an object', function () {
    it('should throw', function () {
      expect(function () {
        var d = new Decimal({});
      }).toThrow();
    });
  });
  describe('from a null value', function () {
    it('should throw', function () {
      expect(function () {
        var d = new Decimal(null);
      }).toThrow();
    });
  });
  describe('from an undefined value', function () {
    it('should throw', function () {
      expect(function () {
        var d = new Decimal(undefined);
      }).toThrow();
    });
  });
  describe('from the number forty two', function () {
    var d;
    beforeEach(function () {
      d = new Decimal(42);
    });
    it('should not be positive', function () {
      expect(d.getIsPositive()).toEqual(true);
    });
    it('should not be negative', function () {
      expect(d.getIsNegative()).toEqual(false);
    });
    it('should be zero', function () {
      expect(d.getIsZero()).toEqual(false);
    });
    it('should approximate zero', function () {
      expect(d.getIsZero(true)).toEqual(false);
    });
    it('the floating point export should equal the meaning of life', function () {
      expect(d.toFloat()).toEqual(42);
    });
    it('the fixed export should equal "42"', function () {
      expect(d.toFixed()).toEqual('42');
    });
    describe('and adding the number one', function () {
      var e;
      beforeEach(function () {
        e = d.add(1);
      });
      it('should return a Decimal instance', function () {
        expect(e instanceof Decimal).toEqual(true);
      });
      it('should be a different instance', function () {
        expect(e).not.toBe(d);
      });
      it('should equal forty three', function () {
        expect(e.toFloat()).toEqual(43);
      });
      it('should not mutate the original instance', function () {
        expect(d.toFloat()).toEqual(42);
      });
    });
    describe('and adding a Decimal having a value of one', function () {
      var e;
      var x;
      beforeEach(function () {
        e = d.add(x = new Decimal(1));
      });
      it('should return a Decimal instance', function () {
        expect(e instanceof Decimal).toEqual(true);
      });
      it('should be a different instance', function () {
        expect(e).not.toBe(d);
      });
      it('should equal forty three', function () {
        expect(e.toFloat()).toEqual(43);
      });
      it('should not mutate the original instance', function () {
        expect(d.toFloat()).toEqual(42);
      });
      it('should not mutate the operand', function () {
        expect(x.toFloat()).toEqual(1);
      });
    });
    describe('and dividing by zero', function () {
      it('should throw', function () {
        expect(function () {
          var e = d.divideBy(0);
        }).toThrow();
      });
    });
  });
  describe('from the string "1"', function () {
    var d;
    beforeEach(function () {
      d = new Decimal("1");
    });
    it('should be positive', function () {
      expect(d.getIsPositive()).toEqual(true);
    });
    it('should not be negative', function () {
      expect(d.getIsNegative()).toEqual(false);
    });
    it('should be zero', function () {
      expect(d.getIsZero()).toEqual(false);
    });
    it('the fixed export should equal "1"', function () {
      expect(d.toFixed()).toEqual('1');
    });
  });
});
describe('When checking for integers', function () {
  'use strict';

  it('should indicate a zero value is an integer', function () {
    expect(new Decimal('0').getIsInteger()).toEqual(true);
  });
  it('should indicate a value of one is an integer', function () {
    expect(new Decimal('1').getIsInteger()).toEqual(true);
  });
  it('should indicate a value of negative one is an integer', function () {
    expect(new Decimal('-1').getIsInteger()).toEqual(true);
  });
  it('should indicate a value of one and a half is not an integer', function () {
    expect(new Decimal('1.5').getIsInteger()).toEqual(false);
  });
  it('should indicate a value of slightly less than one is an not integer', function () {
    const numerator = new Decimal('999999999');
    const denominator = new Decimal('1000000000');
    expect(numerator.divide(denominator).getIsInteger()).toEqual(false);
  });
  it('should indicate a value of slightly greater than one is an not integer', function () {
    const numerator = new Decimal('1000000000');
    const denominator = new Decimal('999999999');
    expect(numerator.divide(denominator).getIsInteger()).toEqual(false);
  });
});
describe('When counting the number of decimal places', function () {
  'use strict';

  it('should indicate a value of zero has no decimal places', function () {
    expect(new Decimal('0').getDecimalPlaces()).toEqual(0);
  });
  it('should indicate a value of one has no decimal places', function () {
    expect(new Decimal('1').getDecimalPlaces()).toEqual(0);
  });
  it('should indicate a value of negative one has no decimal places', function () {
    expect(new Decimal('-1').getDecimalPlaces()).toEqual(0);
  });
  it('should indicate a value of twenty three has no decimal places', function () {
    expect(new Decimal('23').getDecimalPlaces()).toEqual(0);
  });
  it('should indicate a value of twenty three has no decimal places', function () {
    expect(new Decimal('-23').getDecimalPlaces()).toEqual(0);
  });
  it('should indicate a value of one tenth has one decimal places', function () {
    expect(new Decimal('0.1').getDecimalPlaces()).toEqual(1);
  });
  it('should indicate a value of negative one tenth has one decimal places', function () {
    expect(new Decimal('-0.1').getDecimalPlaces()).toEqual(1);
  });
  it('should indicate a value of one eighth has one decimal places', function () {
    expect(new Decimal('0.125').getDecimalPlaces()).toEqual(3);
  });
  it('should indicate a value of negative one eighth has one decimal places', function () {
    expect(new Decimal('-0.125').getDecimalPlaces()).toEqual(3);
  });
  it('should indicate a value of one hundredth has one decimal places', function () {
    expect(new Decimal('0.01').getDecimalPlaces()).toEqual(2);
  });
  it('should indicate a value of negative one hundredth has one decimal places', function () {
    expect(new Decimal('-0.01').getDecimalPlaces()).toEqual(2);
  });
  it('should indicate a value of "123.123456789012345678901234 has 24 decimal places', function () {
    expect(new Decimal('123.123456789012345678901234').getDecimalPlaces()).toEqual(24);
  });
  it('should indicate a value of "-123.123456789012345678901234 has 24 decimal places', function () {
    expect(new Decimal('-123.123456789012345678901234').getDecimalPlaces()).toEqual(24);
  });
});
describe('When checking for values that approximate zero', function () {
  'use strict';

  it('A value of "0.01" should approximate zero, when rounding to one decimal places', function () {
    expect(new Decimal('0.01').getIsZero(true, 1)).toEqual(true);
  });
  it('A value of "0.09" should not approximate zero, when rounding to one decimal places', function () {
    expect(new Decimal('0.09').getIsZero(true, 1)).toEqual(false);
  });
  it('A value of "0.01" should not approximate zero, when rounding is not specified', function () {
    expect(new Decimal('0.01').getIsZero(true)).toEqual(false);
  });
  it('A value of "0.09" should not approximate zero, when rounding is not specified', function () {
    expect(new Decimal('0.09').getIsZero(true)).toEqual(false);
  });
});
describe('When raising to a power', function () {
  'use strict';

  it('The value of 2 raised to 8 should be 256', function () {
    expect(new Decimal(2).raise(8).getIsEqual(256)).toEqual(true);
  });
  it('The value of 2 raised to -1 should be 0.5', function () {
    expect(new Decimal(2).raise(-1).getIsEqual(0.5)).toEqual(true);
  });
  it('The value of 2 raised to 0 should be 1', function () {
    expect(new Decimal(2).raise(0).getIsEqual(1)).toEqual(true);
  });
});
describe('When checking for values that approximate each other', function () {
  'use strict';

  it('A value of "1" should approximate a value of "1" (when using ten significant digits)', function () {
    expect(new Decimal('1').getIsApproximate(new Decimal('1'), 10)).toEqual(true);
  });
  it('A value of "10" should approximate a value of "10" (when using zero significant digits)', function () {
    expect(new Decimal('10').getIsApproximate(new Decimal('10'), 0)).toEqual(true);
  });
  it('A value of "10" should not approximate a value of "10.0001" (when using zero significant digits)', function () {
    expect(new Decimal('10').getIsApproximate(new Decimal('10.0001'), 0)).toEqual(false);
  });
  it('A value of "10.0001" should not approximate a value of "10" (when using zero significant digits)', function () {
    expect(new Decimal('10.0001').getIsApproximate(new Decimal('10'), 0)).toEqual(false);
  });
  it('A value of "0.01" should approximate a value of "0.019" (when using two significant digits)', function () {
    expect(new Decimal('0.01').getIsApproximate(new Decimal('0.019'), 2)).toEqual(true);
  });
  it('A value of "0.019" should approximate a value of "0.01" (when using two significant digits)', function () {
    expect(new Decimal('0.019').getIsApproximate(new Decimal('0.01'), 2)).toEqual(true);
  });
  it('A value of "-0.01" should approximate a value of "-0.019" (when using two significant digits)', function () {
    expect(new Decimal('-0.01').getIsApproximate(new Decimal('-0.019'), 2)).toEqual(true);
  });
  it('A value of "-0.019" should approximate a value of "-0.01" (when using two significant digits)', function () {
    expect(new Decimal('-0.019').getIsApproximate(new Decimal('-0.01'), 2)).toEqual(true);
  });
  it('A value of "0.01" should approximate a value of "0.009" (when using two significant digits)', function () {
    expect(new Decimal('0.01').getIsApproximate(new Decimal('0.009'), 2)).toEqual(true);
  });
  it('A value of "0.009" should approximate a value of "0.01" (when using two significant digits)', function () {
    expect(new Decimal('0.009').getIsApproximate(new Decimal('0.01'), 2)).toEqual(true);
  });
  it('A value of "0.01" should not approximate a value of "0.02" (when using two significant digits)', function () {
    expect(new Decimal('0.01').getIsApproximate(new Decimal('0.02'), 2)).toEqual(false);
  });
  it('A value of "0.02" should not approximate a value of "0.01" (when using two significant digits)', function () {
    expect(new Decimal('0.02').getIsApproximate(new Decimal('0.01'), 2)).toEqual(false);
  });
  it('A value of "0.01" should not approximate a value of "-0.01" (when using two significant digits)', function () {
    expect(new Decimal('0.01').getIsApproximate(new Decimal('-0.01'), 2)).toEqual(false);
  });
  it('A value of "-0.01" should not approximate a value of "0.01" (when using two significant digits)', function () {
    expect(new Decimal('-0.01').getIsApproximate(new Decimal('0.01'), 2)).toEqual(false);
  });
});
describe('When cloning a decimal', function () {
  'use strict';

  var source;
  var clone;
  beforeEach(function () {
    source = new Decimal(Math.PI);
    clone = Decimal.clone(source);
  });
  it('the cloned instance should not be the same as the source instance', function () {
    expect(clone).not.toBe(source);
  });
  it('the cloned instance should equal the source instance', function () {
    expect(source.getIsEqual(clone)).toEqual(true);
  });
});

},{"./../../../lang/Decimal":22}],95:[function(require,module,exports){
var Disposable = require('./../../../lang/Disposable');

describe('When a Disposable is extended', function () {
  'use strict';

  class TestDisposable extends Disposable {
    constructor() {
      super();
      this._disposeSpy = jasmine.createSpy('disposeAction');
    }

    getDisposeSpy() {
      return this._disposeSpy;
    }

    _onDispose() {
      this._disposeSpy();
    }

  }

  var testDisposable;
  beforeEach(function () {
    testDisposable = new TestDisposable();
  });
  it('should not indicate that it has been disposed', function () {
    expect(testDisposable.getIsDisposed()).toEqual(false);
  });
  it('should not have triggered the dispose action', function () {
    expect(testDisposable.getDisposeSpy()).not.toHaveBeenCalled();
  });
  describe("and the instance is disposed", function () {
    beforeEach(function () {
      testDisposable.dispose();
    });
    it('should not indicate that it has been disposed', function () {
      expect(testDisposable.getIsDisposed()).toEqual(true);
    });
    it('should have triggered the dispose action', function () {
      expect(testDisposable.getDisposeSpy().calls.count()).toEqual(1);
    });
    describe("and the instance is disposed again", function () {
      beforeEach(function () {
        testDisposable.dispose();
      });
      it('should not indicate that it has been disposed', function () {
        expect(testDisposable.getIsDisposed()).toEqual(true);
      });
      it('should not dispose action again', function () {
        expect(testDisposable.getDisposeSpy().calls.count()).toEqual(1);
      });
    });
  });
});
describe('When a Disposable.fromAction creates a Disposable', function () {
  'use strict';

  var testDisposable;
  var testDisposableSpy;
  beforeEach(function () {
    testDisposable = Disposable.fromAction(testDisposableSpy = jasmine.createSpy('testDisposableSpy'));
  });
  it('should be an instance of Disposable', function () {
    expect(testDisposable instanceof Disposable).toEqual(true);
  });
  it('should not indicate that it has been disposed', function () {
    expect(testDisposable.getIsDisposed()).toEqual(false);
  });
  it('should not have triggered the dispose action', function () {
    expect(testDisposableSpy).not.toHaveBeenCalled();
  });
  describe("and the instance is disposed", function () {
    beforeEach(function () {
      testDisposable.dispose();
    });
    it('should not indicate that it has been disposed', function () {
      expect(testDisposable.getIsDisposed()).toEqual(true);
    });
    it('should have triggered the dispose action', function () {
      expect(testDisposableSpy.calls.count()).toEqual(1);
    });
    describe("and the instance is disposed again", function () {
      beforeEach(function () {
        testDisposable.dispose();
      });
      it('should not indicate that it has been disposed', function () {
        expect(testDisposable.getIsDisposed()).toEqual(true);
      });
      it('should not dispose action again', function () {
        expect(testDisposableSpy.calls.count()).toEqual(1);
      });
    });
  });
});

},{"./../../../lang/Disposable":23}],96:[function(require,module,exports){
var Enum = require('./../../../lang/Enum');

describe('When Enum is extended (as types EnumA and EnumB) and type items are added to each (X and Y)', function () {
  'use strict';

  class EnumA extends Enum {
    constructor(code, description) {
      super(code, description);
    }

  }

  class EnumB extends Enum {
    constructor(code, description) {
      super(code, description);
    }

  }

  var ax = new EnumA('x', 'A-X');
  var ay = new EnumA('y', 'A-Y');
  var bx = new EnumB('x', 'B-X');
  var by = new EnumB('y', 'B-Y');
  it('should be able to find X in EnumA using the code', function () {
    expect(Enum.fromCode(EnumA, 'x')).toBe(ax);
  });
  it('should be able to find Y in EnumA using the code', function () {
    expect(Enum.fromCode(EnumA, 'y')).toBe(ay);
  });
  it('should be able to find X in EnumB using the code', function () {
    expect(Enum.fromCode(EnumB, 'x')).toBe(bx);
  });
  it('should be able to find Y in EnumB using the code', function () {
    expect(Enum.fromCode(EnumB, 'y')).toBe(by);
  });
  describe('and a duplicate item (A-x) is added', function () {
    var axx = new EnumA('x', 'A-XX');
    it('should be still find the original instance in EnumA for X', function () {
      expect(Enum.fromCode(EnumA, 'x')).toBe(ax);
    });
    it('should should equal the original instance (for X)', function () {
      expect(Enum.fromCode(EnumA, 'x').equals(axx)).toBe(true);
    });
  });
});

},{"./../../../lang/Enum":24}],97:[function(require,module,exports){
var Currency = require('./../../../lang/Currency');

var Decimal = require('./../../../lang/Decimal');

var Rate = require('./../../../lang/Rate');

describe('When parsing an "^EURUSD" rate of 1.2', function () {
  'use strict';

  var rate;
  beforeEach(function () {
    rate = Rate.fromPair(1.2, '^EURUSD');
  });
  it('the quote currency should be USD', function () {
    expect(rate.quote.code).toEqual('USD');
  });
  it('the base currency should be EUR', function () {
    expect(rate.base.code).toEqual('EUR');
  });
  it('the numerator currency should be USD', function () {
    expect(rate.numerator.code).toEqual('USD');
  });
  it('the denominator currency should be EUR', function () {
    expect(rate.denominator.code).toEqual('EUR');
  });
  it('the value should be 1.2', function () {
    expect(rate.decimal.getIsEqual(1.2)).toEqual(true);
  });
  describe('When converting 10 USD to EUR', function () {
    it('should be 8.33 EUR', function () {
      expect(Rate.convert(new Decimal(10), Currency.USD, Currency.EUR, rate).round(2).getIsEqual(8.33)).toEqual(true);
    });
  });
  describe('When converting 10 EUR to USD', function () {
    it('should be 12 USD', function () {
      expect(Rate.convert(new Decimal(10), Currency.EUR, Currency.USD, rate).round(2).getIsEqual(12)).toEqual(true);
    });
  });
});
describe('When parsing an "^USDEUR" rate of 0.8333', function () {
  'use strict';

  var rate;
  beforeEach(function () {
    rate = Rate.fromPair(0.8333, '^USDEUR');
  });
  it('the quote currency should be EUR', function () {
    expect(rate.quote.code).toEqual('EUR');
  });
  it('the base currency should be USD', function () {
    expect(rate.base.code).toEqual('USD');
  });
  it('the numerator currency should be EUR', function () {
    expect(rate.numerator.code).toEqual('EUR');
  });
  it('the denominator currency should be USD', function () {
    expect(rate.denominator.code).toEqual('USD');
  });
  it('the value should be 0.8333', function () {
    expect(rate.decimal.getIsEqual(0.8333)).toEqual(true);
  });
  describe('When converting 10 USD to EUR', function () {
    it('should be 8.33 EUR', function () {
      expect(Rate.convert(new Decimal(10), Currency.USD, Currency.EUR, rate).round(2).getIsEqual(8.33)).toEqual(true);
    });
  });
  describe('When converting 10 EUR to USD', function () {
    it('should be 12 USD', function () {
      expect(Rate.convert(new Decimal(10), Currency.EUR, Currency.USD, rate).round(2).getIsEqual(12)).toEqual(true);
    });
  });
});

},{"./../../../lang/Currency":20,"./../../../lang/Decimal":22,"./../../../lang/Rate":26}],98:[function(require,module,exports){
var Timestamp = require('./../../../lang/Timestamp');

describe('When Timestamp is created from a timestamp (1502372574350)', function () {
  'use strict';

  var instance;
  beforeEach(function () {
    instance = new Timestamp(1502372574350);
  });
  it('should not have instantiated the underlying moment', function () {
    expect(instance._moment).toEqual(null);
  });
  it('should know the timestamp', function () {
    expect(instance.timestamp).toEqual(1502372574350);
  });
  describe('and the "moment" property is accessed', function () {
    var m;
    beforeEach(function () {
      m = instance.moment;
    });
    it('should not have instantiated the underlying moment', function () {
      expect(instance._moment).not.toEqual(null);
    });
    it('should return a moment', function () {
      expect(m.isValid()).toEqual(true);
    });
    describe('and the "moment" property is accessed (again)', function () {
      var n;
      beforeEach(function () {
        n = instance.moment;
      });
      it('should return the same moment', function () {
        expect(m).toBe(n);
      });
    });
  });
});
describe('When Timestamp is created for the current moment', function () {
  'use strict';

  var instance;
  beforeEach(function () {
    instance = Timestamp.now();
  });
  it('should not be close to the current time', function () {
    const milliseconds = new Date().getTime();
    expect(milliseconds - instance.timestamp < 500).toEqual(true);
  });
});

},{"./../../../lang/Timestamp":27}],99:[function(require,module,exports){
var Timezones = require('./../../../lang/Timezones');

describe('When accessing static items', function () {
  'use strict';

  it('The timezone for Chicago should return the expected item', function () {
    expect(Timezones.AMERICA_CHICAGO.code).toEqual('America/Chicago');
  });
  it('The timezone for New York should return the expected item', function () {
    expect(Timezones.AMERICA_NEW_YORK.code).toEqual('America/New_York');
  });
});
describe('When calculating timezone offset on 2019-10-02 UTC', function () {
  let timestamp;
  beforeEach(() => {
    timestamp = new Date(2019, 9, 2, 0, 0, 0).getTime();
  });
  it('The UTC offset should be 0', function () {
    expect(Timezones.UTC.getUtcOffset(timestamp)).toEqual(0);
  });
  it('The AMERICA_CHICAGO offset should be -300', function () {
    expect(Timezones.AMERICA_CHICAGO.getUtcOffset(timestamp)).toEqual(-300);
  });
  it('The AMERICA_NEW_YORK offset should be -240', function () {
    expect(Timezones.AMERICA_NEW_YORK.getUtcOffset(timestamp)).toEqual(-240);
  });
  it('The Europe/Minsk offset should be 180', function () {
    expect(Timezones.parse('Europe/Minsk').getUtcOffset(timestamp)).toEqual(180);
  });
});
describe('When calculating timezone offset on 2019-11-04 UTC', function () {
  let timestamp;
  beforeEach(() => {
    timestamp = new Date(2019, 10, 4, 0, 0, 0).getTime();
  });
  it('The UTC offset should be 0', function () {
    expect(Timezones.UTC.getUtcOffset(timestamp)).toEqual(0);
  });
  it('The AMERICA_CHICAGO offset should be -360', function () {
    expect(Timezones.AMERICA_CHICAGO.getUtcOffset(timestamp)).toEqual(-360);
  });
  it('The AMERICA_NEW_YORK offset should be -300', function () {
    expect(Timezones.AMERICA_NEW_YORK.getUtcOffset(timestamp)).toEqual(-300);
  });
  it('The Europe/Minsk offset should be 180', function () {
    expect(Timezones.parse('Europe/Minsk').getUtcOffset(timestamp)).toEqual(180);
  });
});

},{"./../../../lang/Timezones":28}],100:[function(require,module,exports){
var array = require('./../../../lang/array');

describe('when reducing an array to unique values', function () {
  'use strict';

  describe('and using the first four rows of pascals triangle', function () {
    var unique;
    beforeEach(function () {
      unique = array.unique([1, 1, 1, 1, 2, 1, 1, 3, 3, 1]);
    });
    it('should only contain 3 unique elements', function () {
      expect(unique.length).toEqual(3);
    });
    it('should contain 1', function () {
      expect(unique.indexOf(1)).toEqual(0);
    });
    it('should contain 2', function () {
      expect(unique.indexOf(2)).toEqual(1);
    });
    it('should contain 3', function () {
      expect(unique.indexOf(3)).toEqual(2);
    });
  });
});
describe('when reducing an array of objects to unique values', function () {
  'use strict';

  describe('and using the first four rows of pascals triangle', function () {
    var unique;
    var one;
    var two;
    var three;
    var four;
    var five;
    var six;
    beforeEach(function () {
      unique = array.uniqueBy([one = {
        x: 1
      }, two = {
        x: 2
      }, three = {
        x: 3
      }, four = {
        x: 1
      }, five = {
        x: 2
      }, six = {
        x: 3
      }], function (obj) {
        return obj.x;
      });
    });
    it('should only contain 3 unique elements', function () {
      expect(unique.length).toEqual(3);
    });
    it('should contain the first item whose value is one', function () {
      expect(unique[0]).toBe(one);
    });
    it('should contain the first item whose value is two', function () {
      expect(unique[1]).toBe(two);
    });
    it('should contain the first item whose value is three', function () {
      expect(unique[2]).toBe(three);
    });
  });
});
describe('when partitioning an array of three items', function () {
  'use strict';

  var original;
  beforeEach(function () {
    original = [1, 2, 3];
  });
  describe('using a partition size of 10', function () {
    var partitions;
    beforeEach(function () {
      partitions = array.partition(original, 10);
    });
    it('should return an array', function () {
      expect(partitions instanceof Array).toEqual(true);
    });
    it('should return a copy of the original array', function () {
      expect(partitions).not.toBe(original);
    });
    it('should contain one partition', function () {
      expect(partitions.length).toEqual(1);
    });
    it('the first partition should contain three items', function () {
      expect(partitions[0].length).toEqual(3);
    });
    it('the first partition item should be the first item', function () {
      expect(partitions[0][0]).toBe(original[0]);
    });
    it('the second partition item should be the first item', function () {
      expect(partitions[0][1]).toBe(original[1]);
    });
    it('the third partition item should be the first item', function () {
      expect(partitions[0][2]).toBe(original[2]);
    });
  });
  describe('using a partition size of two', function () {
    var partitions;
    beforeEach(function () {
      partitions = array.partition(original, 2);
    });
    it('should return an array', function () {
      expect(partitions instanceof Array).toEqual(true);
    });
    it('should return a copy of the original array', function () {
      expect(partitions).not.toBe(original);
    });
    it('should contain two partition', function () {
      expect(partitions.length).toEqual(2);
    });
    it('the first partition should contain two items', function () {
      expect(partitions[0].length).toEqual(2);
    });
    it('the second partition should contain one item', function () {
      expect(partitions[1].length).toEqual(1);
    });
    it('the first item of the first partition should be the first item', function () {
      expect(partitions[0][0]).toBe(original[0]);
    });
    it('the second item of the first partition should be the second item', function () {
      expect(partitions[0][1]).toBe(original[1]);
    });
    it('the first item of the second partition should be the third item', function () {
      expect(partitions[1][0]).toBe(original[2]);
    });
  });
});
describe('when partitioning empty array', function () {
  'use strict';

  var original;
  beforeEach(function () {
    original = [];
  });
  describe('using a partition size of 10', function () {
    var partitions;
    beforeEach(function () {
      partitions = array.partition(original, 10);
    });
    it('an empty array should be returned', function () {
      expect(partitions.length).toEqual(0);
    });
  });
});
describe('when flattening an array', function () {
  'use strict';

  var arrayOne;
  var arrayTwo;
  var itemA;
  var itemB;
  var itemC;
  var itemD;
  beforeEach(function () {
    arrayOne = [itemA = 'a', itemB = 'b', itemC = ['c']];
    arrayTwo = [itemD = 'd'];
  });
  describe('without using recursion', function () {
    var result;
    beforeEach(function () {
      result = array.flatten([arrayOne, arrayTwo], false);
    });
    it('the first item should be "a"', function () {
      expect(result[0]).toBe(itemA);
    });
    it('the second item should be "b"', function () {
      expect(result[1]).toBe(itemB);
    });
    it('the third item should be "c"', function () {
      expect(result[2]).toBe(itemC);
    });
    it('the forth item should be "d"', function () {
      expect(result[3]).toBe(itemD);
    });
  });
  describe('and using recursion', function () {
    var result;
    beforeEach(function () {
      result = array.flatten([arrayOne, arrayTwo], true);
    });
    it('the first item should be "a"', function () {
      expect(result[0]).toBe(itemA);
    });
    it('the second item should be "b"', function () {
      expect(result[1]).toBe(itemB);
    });
    it('the third item should be "c"', function () {
      expect(result[2]).toBe('c');
    });
    it('the forth item should be "d"', function () {
      expect(result[3]).toBe(itemD);
    });
  });
});
describe('when grouping an array', function () {
  'use strict';

  describe('and using objects containing the first three rows of pascals triangle', function () {
    var groups;
    beforeEach(function () {
      groups = array.groupBy([{
        value: 1
      }, {
        value: 1
      }, {
        value: 1
      }, {
        value: 1
      }, {
        value: 2
      }, {
        value: 1
      }], function (item) {
        return item.value;
      });
    });
    it('should only contain 2 keys', function () {
      expect(Object.keys(groups).length).toEqual(2);
    });
    it('should have a key for number one', function () {
      expect(groups.hasOwnProperty(1)).toEqual(true);
    });
    it('should have five items grouped for the number one', function () {
      expect(groups[1].length).toEqual(5);
    });
    it('should an object with a value of one for each item grouped for the number one', function () {
      var group = groups[1];

      for (var i = 0; i < group.length; i++) {
        expect(group[i].value).toEqual(1);
      }
    });
    it('should have one item grouped for the number two', function () {
      expect(groups[2].length).toEqual(1);
    });
    it('should an object with a value of two for each item grouped for the number two', function () {
      var group = groups[2];

      for (var i = 0; i < group.length; i++) {
        expect(group[i].value).toEqual(2);
      }
    });
  });
  describe('when indexing an array', function () {
    describe('and using objects containing the first three prime numbers', function () {
      var groups;
      var one;
      var two;
      var three;
      beforeEach(function () {
        groups = array.indexBy([one = {
          value: 1
        }, two = {
          value: 2
        }, three = {
          value: 3
        }], function (item) {
          return item.value;
        });
      });
      it('should contain 3 keys', function () {
        expect(Object.keys(groups).length).toEqual(3);
      });
      it('should have a key for number one', function () {
        expect(groups.hasOwnProperty(1)).toEqual(true);
      });
      it('should have a key for number two', function () {
        expect(groups.hasOwnProperty(2)).toEqual(true);
      });
      it('should have a key for number three', function () {
        expect(groups.hasOwnProperty(3)).toEqual(true);
      });
      it('should have the first object at key one', function () {
        expect(groups[1]).toBe(one);
      });
      it('should have the first object at key one', function () {
        expect(groups[2]).toBe(two);
      });
      it('should have the first object at key one', function () {
        expect(groups[3]).toBe(three);
      });
    });
  });
});
describe('when batching an array', function () {
  describe('when keys are sorted', function () {
    var batches;
    var one, two, three, four, five;
    beforeEach(function () {
      batches = array.batchBy([one = {
        value: 'a'
      }, two = {
        value: 'b'
      }, three = {
        value: 'b'
      }, four = {
        value: 'c'
      }, five = {
        value: 'c'
      }], function (item) {
        return item.value;
      });
    });
    it('should contain 3 batches', function () {
      expect(batches.length).toEqual(3);
    });
    it('should have 1 item in first batch', function () {
      expect(batches[0].length).toEqual(1);
    });
    it('should have 2 items in second batch', function () {
      expect(batches[1].length).toEqual(2);
    });
    it('should have 2 items in third batch', function () {
      expect(batches[2].length).toEqual(2);
    });
  });
  describe('when keys are not sorted', function () {
    var batches;
    var one, two, three, four, five;
    beforeEach(function () {
      batches = array.batchBy([one = {
        value: 'a'
      }, two = {
        value: 'b'
      }, three = {
        value: 'c'
      }, four = {
        value: 'a'
      }, five = {
        value: 'a'
      }], function (item) {
        return item.value;
      });
    });
    it('should contain 4 batches', function () {
      expect(batches.length).toEqual(4);
    });
    it('should have 1 item in first batch', function () {
      expect(batches[0].length).toEqual(1);
    });
    it('should have 1 item in second batch', function () {
      expect(batches[1].length).toEqual(1);
    });
    it('should have 1 item in third batch', function () {
      expect(batches[2].length).toEqual(1);
    });
    it('should have 2 items in fourth batch', function () {
      expect(batches[3].length).toEqual(2);
    });
  });
});
describe('when calculating the "difference" between two arrays', function () {
  describe('and the arrays are empty', function () {
    var difference;
    beforeEach(() => {
      difference = array.difference([], []);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(difference.length).toEqual(0);
    });
  });
  describe('and first array is [1,2] and the second array is [2,3]', function () {
    var difference;
    beforeEach(() => {
      difference = array.difference([1, 2], [2, 3]);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain one element', function () {
      expect(difference.length).toEqual(1);
    });
    it('the first element should be 1', function () {
      expect(difference[0]).toEqual(1);
    });
  });
  describe('and first array is [2,3] and the second array is [1,2]', function () {
    var difference;
    beforeEach(() => {
      difference = array.difference([2, 3], [1, 2]);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain one element', function () {
      expect(difference.length).toEqual(1);
    });
    it('the first element should be 3', function () {
      expect(difference[0]).toEqual(3);
    });
  });
  describe('and first array has a unique object and both arrays share an object', function () {
    var same;
    var unique;
    var difference;
    beforeEach(() => {
      same = {};
      difference = array.difference([same, unique = {}], [same]);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain one element', function () {
      expect(difference.length).toEqual(1);
    });
    it('the first element should be the unique object', function () {
      expect(difference[0]).toBe(unique);
    });
  });
  describe('and second array has a unique object and both arrays share an object', function () {
    var same;
    var unique;
    var difference;
    beforeEach(() => {
      same = {};
      difference = array.difference([same], [same, unique = {}]);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain zero elements', function () {
      expect(difference.length).toEqual(0);
    });
  });
});
describe('when calculating the "difference" between two arrays using key selectors', function () {
  describe('and the arrays are empty', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceBy([], [], x => x.key);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(difference.length).toEqual(0);
    });
  });
  describe('and first array is [{key:1}, {key:2}] and the second array is [{key:2}, {key:3}]', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceBy([{
        key: 1
      }, {
        key: 2
      }], [{
        key: 2
      }, {
        key: 3
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain one element', function () {
      expect(difference.length).toEqual(1);
    });
    it('the first element key should be 1', function () {
      expect(difference[0].key).toEqual(1);
    });
  });
  describe('and first array is [{key:2}, {key:3}] and the second array is [{key:1}, {key:2}] ', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceBy([{
        key: 2
      }, {
        key: 3
      }], [{
        key: 1
      }, {
        key: 2
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain one element', function () {
      expect(difference.length).toEqual(1);
    });
    it('the first element key should be 3', function () {
      expect(difference[0].key).toEqual(3);
    });
  });
});
describe('when calculating the "union" of two arrays', function () {
  describe('and the arrays are empty', function () {
    var union;
    beforeEach(() => {
      union = array.union([], []);
    });
    it('should be an array', function () {
      expect(union instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(union.length).toEqual(0);
    });
  });
  describe('and first array is [1,2] and the second array is [2,3]', function () {
    var union;
    beforeEach(() => {
      union = array.union([1, 2], [2, 3]);
    });
    it('should be an array', function () {
      expect(union instanceof Array).toEqual(true);
    });
    it('should contain three elements', function () {
      expect(union.length).toEqual(3);
    });
    it('the first element should be 1', function () {
      expect(union[0]).toEqual(1);
    });
    it('the second element should be 2', function () {
      expect(union[1]).toEqual(2);
    });
    it('the third element should be 3', function () {
      expect(union[2]).toEqual(3);
    });
  });
  describe('and first array has a unique object and both arrays share an object', function () {
    var same;
    var unique;
    var union;
    beforeEach(() => {
      same = {};
      union = array.union([same, unique = {}], [same]);
    });
    it('should be an array', function () {
      expect(union instanceof Array).toEqual(true);
    });
    it('should contain two elements', function () {
      expect(union.length).toEqual(2);
    });
    it('the first element the should be "same" object', function () {
      expect(union[0]).toBe(same);
    });
    it('the second element the should be "unique" object', function () {
      expect(union[1]).toBe(unique);
    });
  });
});
describe('when calculating the "union" of two arrays using key selectors', function () {
  describe('and the arrays are empty', function () {
    var union;
    beforeEach(() => {
      union = array.unionBy([], [], x => x.key);
    });
    it('should be an array', function () {
      expect(union instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(union.length).toEqual(0);
    });
  });
  describe('and first array is [{key:1}, {key:2}] and the second array is [{key:2}, {key:3}]', function () {
    var union;
    beforeEach(() => {
      union = array.unionBy([{
        key: 1
      }, {
        key: 2
      }], [{
        key: 2
      }, {
        key: 3
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(union instanceof Array).toEqual(true);
    });
    it('should contain three elements', function () {
      expect(union.length).toEqual(3);
    });
    it('the first element key should be 1', function () {
      expect(union[0].key).toEqual(1);
    });
    it('the second element key should be 2', function () {
      expect(union[1].key).toEqual(2);
    });
    it('the third element key should be 3', function () {
      expect(union[2].key).toEqual(3);
    });
  });
  describe('and first array has a unique object and both arrays share an object', function () {
    var union;
    beforeEach(() => {
      union = array.unionBy([{
        key: 1
      }, {
        key: 2
      }], [{
        key: 2
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(union instanceof Array).toEqual(true);
    });
    it('should contain two elements', function () {
      expect(union.length).toEqual(2);
    });
    it('the first element key the should be "same" object key', function () {
      expect(union[0].key).toEqual(1);
    });
    it('the second element key the should be "unique" object key', function () {
      expect(union[1].key).toEqual(2);
    });
  });
});
describe('when calculating the "intersection" of two arrays', function () {
  describe('and the arrays are empty', function () {
    var intersection;
    beforeEach(() => {
      intersection = array.intersection([], []);
    });
    it('should be an array', function () {
      expect(intersection instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(intersection.length).toEqual(0);
    });
  });
  describe('and first array is [1,2] and the second array is [2,3]', function () {
    var intersection;
    beforeEach(() => {
      intersection = array.intersection([1, 2], [2, 3]);
    });
    it('should be an array', function () {
      expect(intersection instanceof Array).toEqual(true);
    });
    it('should contain one element', function () {
      expect(intersection.length).toEqual(1);
    });
    it('the first element should be 2', function () {
      expect(intersection[0]).toEqual(2);
    });
  });
  describe('and first array has a unique object and both arrays share an object', function () {
    var same;
    var unique;
    var intersection;
    beforeEach(() => {
      same = {};
      intersection = array.intersection([same, unique = {}], [same]);
    });
    it('should be an array', function () {
      expect(intersection instanceof Array).toEqual(true);
    });
    it('should contain one elements', function () {
      expect(intersection.length).toEqual(1);
    });
    it('the first element the "same" object', function () {
      expect(intersection[0]).toBe(same);
    });
  });
});
describe('when calculating the "intersection" of two arrays using key selectors', function () {
  describe('and the arrays are empty', function () {
    var intersection;
    beforeEach(() => {
      intersection = array.intersectionBy([], [], x => x.key);
    });
    it('should be an array', function () {
      expect(intersection instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(intersection.length).toEqual(0);
    });
  });
  describe('and first array is [{key:1}, {key:2}] and the second array is [{key:2}, {key:3}]', function () {
    var intersection;
    beforeEach(() => {
      intersection = array.intersectionBy([{
        key: 1
      }, {
        key: 2
      }], [{
        key: 2
      }, {
        key: 3
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(intersection instanceof Array).toEqual(true);
    });
    it('should contain one element', function () {
      expect(intersection.length).toEqual(1);
    });
    it('the first element should have key 2', function () {
      expect(intersection[0].key).toEqual(2);
    });
  });
  describe('and first array has a unique object and both arrays share an object', function () {
    var same;
    var unique;
    var intersection;
    beforeEach(() => {
      intersection = array.intersectionBy([{
        key: 1
      }, {
        key: 2
      }], [{
        key: 2
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(intersection instanceof Array).toEqual(true);
    });
    it('should contain one elements', function () {
      expect(intersection.length).toEqual(1);
    });
    it('the first element key should the "same" object key', function () {
      expect(intersection[0].key).toEqual(2);
    });
  });
});
describe('when calculating the "symmetric difference" of two arrays', function () {
  describe('and the arrays are empty', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceSymmetric([], []);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(difference.length).toEqual(0);
    });
  });
  describe('and first array is [1,2] and the second array is [2,3]', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceSymmetric([1, 2], [2, 3]);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain two elements', function () {
      expect(difference.length).toEqual(2);
    });
    it('the first element should be 1', function () {
      expect(difference[0]).toEqual(1);
    });
    it('the second element should be 3', function () {
      expect(difference[1]).toEqual(3);
    });
  });
  describe('and first array has a unique object and both arrays share an object', function () {
    var same;
    var unique;
    var difference;
    beforeEach(() => {
      same = {};
      difference = array.differenceSymmetric([same, unique = {}], [same]);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain one elements', function () {
      expect(difference.length).toEqual(1);
    });
    it('the first element the "unique" object', function () {
      expect(difference[0]).toBe(unique);
    });
  });
});
describe('when calculating the "symmetric difference" of two arrays using key selectors', function () {
  describe('and the arrays are empty', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceSymmetricBy([], [], x => x.key);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should be empty', function () {
      expect(difference.length).toEqual(0);
    });
  });
  describe('and first array is [{key:1}, {key:2}] and the second array is [{key:2}, {key:3}]', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceSymmetricBy([{
        key: 1
      }, {
        key: 2
      }], [{
        key: 2
      }, {
        key: 3
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain two elements', function () {
      expect(difference.length).toEqual(2);
    });
    it('the first element should have key 1', function () {
      expect(difference[0].key).toEqual(1);
    });
    it('the second element should be 3', function () {
      expect(difference[1].key).toEqual(3);
    });
  });
  describe('and first array has a unique object and both arrays share an object', function () {
    var difference;
    beforeEach(() => {
      difference = array.differenceSymmetricBy([{
        key: 1
      }, {
        key: 2
      }], [{
        key: 2
      }], x => x.key);
    });
    it('should be an array', function () {
      expect(difference instanceof Array).toEqual(true);
    });
    it('should contain one elements', function () {
      expect(difference.length).toEqual(1);
    });
    it('the first element the "unique" object', function () {
      expect(difference[0].key).toEqual(1);
    });
  });
});
describe('when taking the first item of an array', function () {
  it('an undefined value should be returned from an empty array', function () {
    var value = array.first([]);
    expect(value).toEqual(undefined);
  });
  it('the first value should be returned from a non-empty array', function () {
    var a = {};
    var b = {};
    var value = array.first([a, b]);
    expect(value).toBe(a);
  });
});
describe('when taking the last item of an array', function () {
  it('an undefined value should be returned from an empty array', function () {
    var value = array.last([]);
    expect(value).toEqual(undefined);
  });
  it('the last value should be returned from a non-empty array', function () {
    var a = {};
    var b = {};
    var value = array.last([a, b]);
    expect(value).toBe(b);
  });
});
describe('when removing an item from an array using a predicate', function () {
  var a;
  var item;
  beforeEach(function () {
    a = [{}, item = {}, {}];

    var predicate = function (i) {
      return i === item;
    };

    array.remove(a, predicate);
  });
  it('should have two items', function () {
    expect(a.length).toEqual(2);
  });
  it('the first item should not be the removed item', function () {
    expect(a[0]).not.toBe(item);
  });
  it('the second item should not be the removed item', function () {
    expect(a[1]).not.toBe(item);
  });
});

},{"./../../../lang/array":29}],101:[function(require,module,exports){
var attributes = require('./../../../lang/attributes');

describe('When "attributes.has" is used to check a top-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  describe("and the property exists", function () {
    it("should return true", function () {
      expect(attributes.has(target, "test")).toEqual(true);
    });
  });
  describe("and the property does not exist", function () {
    it("should return true", function () {
      expect(attributes.has(target, "name")).toEqual(false);
    });
  });
});
describe('When "attributes.has" is used to check a top-level property (with an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  describe("and the property exists", function () {
    it("should return true", function () {
      expect(attributes.has(target, ["test"])).toEqual(true);
    });
  });
  describe("and the property does not exist", function () {
    it("should return true", function () {
      expect(attributes.has(target, ["name"])).toEqual(false);
    });
  });
});
describe('When "attributes.has" is used to check a second-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      },
      a: undefined,
      b: null
    };
  });
  describe("and the property exists", function () {
    it("should return true", function () {
      expect(attributes.has(target, "nested.test")).toEqual(true);
    });
  });
  describe("and the property does not exist", function () {
    it("should return true", function () {
      expect(attributes.has(target, "nested.name")).toEqual(false);
    });
  });
  describe("and the top-level property does not exist", function () {
    it("should return true", function () {
      expect(attributes.has(target, "wrong.name")).toEqual(false);
    });
  });
  describe("and the top-level property exists, but is undefined", function () {
    it("should return true", function () {
      expect(attributes.has(target, "a.name")).toEqual(false);
    });
  });
  describe("and the top-level property exists, but is null", function () {
    it("should return true", function () {
      expect(attributes.has(target, "b.name")).toEqual(false);
    });
  });
});
describe('When "attributes.has" is used to check a second-level property (with an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    it("should return true", function () {
      expect(attributes.has(target, ["nested", "test"])).toEqual(true);
    });
  });
  describe("and the property does not exist", function () {
    it("should return true", function () {
      expect(attributes.has(target, ["nested", "name"])).toEqual(false);
    });
  });
  describe("and the top-level property does not exist", function () {
    it("should return true", function () {
      expect(attributes.has(target, ["wrong", "name"])).toEqual(false);
    });
  });
});
describe('When "attributes.has" is called with an empty string', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  it("should return false", function () {
    expect(attributes.has(target, "")).toEqual(false);
  });
});
describe('When "attributes.has" is called with a zero-length array', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  it("should return false", function () {
    expect(attributes.has(target, [])).toEqual(false);
  });
});
describe('When "attributes.read" is used to get a top-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    it("should return the property value", function () {
      expect(attributes.read(target, "nested.test")).toEqual(123);
    });
  });
  describe("and the property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, "nested.name")).toBe(undefined);
    });
  });
});
describe('When "attributes.read" is used to get a top-level property (with an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    it("should return the property value", function () {
      expect(attributes.read(target, ["nested", "test"])).toEqual(123);
    });
  });
  describe("and the property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, ["nested", "name"])).toBe(undefined);
    });
  });
});
describe('When "attributes.read" is used to get a second-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    it("should return the property value", function () {
      expect(attributes.read(target, "nested.test")).toEqual(123);
    });
  });
  describe("and the property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, "nested.name")).toBe(undefined);
    });
  });
  describe("and the top-level property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, "wrong.name")).toBe(undefined);
    });
  });
});
describe('When "attributes.read" is used to get a second-level property (with an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    it("should return the property value", function () {
      expect(attributes.read(target, ["nested", "test"])).toEqual(123);
    });
  });
  describe("and the property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, ["nested", "name"])).toBe(undefined);
    });
  });
  describe("and the top-level property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, ["wrong", "name"])).toBe(undefined);
    });
  });
});
describe('When "attributes.read" is called with an empty string', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  it("should return an undefined value", function () {
    expect(attributes.read(target, "")).toBe(undefined);
  });
});
describe('When "attributes.read" is called with a zero-length array', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  it("should return an undefined value", function () {
    expect(attributes.read(target, [])).toBe(undefined);
  });
});
describe('When "attributes.write" is used to set a top-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.write(target, "test", "four-five-six");
    });
    it("the property value should be overwritten", function () {
      expect(target.test).toEqual("four-five-six");
    });
  });
  describe("and the property does not exist", function () {
    beforeEach(function () {
      attributes.write(target, "name", "Alice");
    });
    it("the property value should be created and set", function () {
      expect(target.name).toEqual("Alice");
    });
  });
});
describe('When "attributes.write" is used to set a top-level property (with an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.write(target, ["test"], "four-five-six");
    });
    it("the property value should be overwritten", function () {
      expect(target.test).toEqual("four-five-six");
    });
  });
  describe("and the property does not exist", function () {
    beforeEach(function () {
      attributes.write(target, ["name"], "Alice");
    });
    it("the property value should be created and set", function () {
      expect(target.name).toEqual("Alice");
    });
  });
});
describe('When "attributes.write" is used to set a second-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.write(target, "nested.test", "four-five-six");
    });
    it("the property value should be overwritten", function () {
      expect(target.nested.test).toEqual("four-five-six");
    });
  });
  describe("and the second-level property does not exist", function () {
    beforeEach(function () {
      attributes.write(target, "nested.name", "Alice");
    });
    it("the property value should be created and set", function () {
      expect(target.nested.name).toEqual("Alice");
    });
  });
  describe("and the top-level property does not exist", function () {
    beforeEach(function () {
      attributes.write(target, "x.y", "z");
    });
    it("the top-level and second properties value should be created and set", function () {
      expect(target.x.y).toEqual("z");
    });
  });
});
describe('When "attributes.write" is used to set a second-level property (using an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.write(target, ["nested", "test"], "four-five-six");
    });
    it("the property value should be overwritten", function () {
      expect(target.nested.test).toEqual("four-five-six");
    });
  });
  describe("and the second-level property does not exist", function () {
    beforeEach(function () {
      attributes.write(target, ["nested", "name"], "Alice");
    });
    it("the property value should be created and set", function () {
      expect(target.nested.name).toEqual("Alice");
    });
  });
  describe("and the top-level property does not exist", function () {
    beforeEach(function () {
      attributes.write(target, ["x", "y"], "z");
    });
    it("the top-level and second properties value should be created and set", function () {
      expect(target.x.y).toEqual("z");
    });
  });
});
describe('When "attributes.erase" is used to remove a top-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.erase(target, "test");
    });
    it("the property value not exist", function () {
      expect(target.hasOwnProperty("test")).toEqual(false);
    });
  });
  describe("and the property does not exist", function () {
    beforeEach(function () {
      attributes.erase(target, "name");
    });
    it("the target should be unaffected", function () {
      expect(target.hasOwnProperty("test")).toEqual(true);
    });
  });
});
describe('When "attributes.erase" is used to remove a top-level property (using an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      test: 123
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.erase(target, ["test"]);
    });
    it("the property value not exist", function () {
      expect(target.hasOwnProperty("test")).toEqual(false);
    });
  });
  describe("and the property does not exist", function () {
    beforeEach(function () {
      attributes.erase(target, ["name"]);
    });
    it("the target should be unaffected", function () {
      expect(target.hasOwnProperty("test")).toEqual(true);
    });
  });
});
describe('When "attributes.erase" is used to remove a second-level property', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.erase(target, "nested.test");
    });
    it("the property value not exist", function () {
      expect(target.hasOwnProperty("nested")).toEqual(true);
      expect(target.nested.hasOwnProperty("test")).toEqual(false);
    });
  });
  describe("and the second-level property does not exist", function () {
    beforeEach(function () {
      attributes.erase(target, "nested.name");
    });
    it("the target should be unaffected", function () {
      expect(target.hasOwnProperty("nested")).toEqual(true);
      expect(target.nested.hasOwnProperty("test")).toEqual(true);
    });
  });
  describe("and the top-level property does not exist", function () {
    beforeEach(function () {
      attributes.erase(target, "x.y");
    });
    it("the target should be unaffected", function () {
      expect(target.hasOwnProperty("nested")).toEqual(true);
      expect(target.nested.hasOwnProperty("test")).toEqual(true);
    });
  });
});
describe('When "attributes.erase" is used to remove a second-level property (using an array)', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 123
      }
    };
  });
  describe("and the property exists", function () {
    beforeEach(function () {
      attributes.erase(target, ["nested", "test"]);
    });
    it("the property value not exist", function () {
      expect(target.hasOwnProperty("nested")).toEqual(true);
      expect(target.nested.hasOwnProperty("test")).toEqual(false);
    });
  });
  describe("and the second-level property does not exist", function () {
    beforeEach(function () {
      attributes.erase(target, ["nested", "name"]);
    });
    it("the target should be unaffected", function () {
      expect(target.hasOwnProperty("nested")).toEqual(true);
      expect(target.nested.hasOwnProperty("test")).toEqual(true);
    });
  });
  describe("and the top-level property does not exist", function () {
    beforeEach(function () {
      attributes.erase(target, ["x", "y"]);
    });
    it("the target should be unaffected", function () {
      expect(target.hasOwnProperty("nested")).toEqual(true);
      expect(target.nested.hasOwnProperty("test")).toEqual(true);
    });
  });
});
describe('When "attributes.read" is used with a null separator', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      'some.key': 1
    };
  });
  describe("and the property exists", function () {
    it("should return the property value", function () {
      expect(attributes.read(target, 'some.key', null)).toEqual(1);
    });
  });
  describe("and the property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, 'another.key', null)).toEqual(undefined);
    });
  });
});
describe('When "attributes.read" is used with a non-default separator', function () {
  'use strict';

  var target;
  beforeEach(function () {
    target = {
      nested: {
        test: 1
      }
    };
  });
  describe("and the property exists", function () {
    it("should return the property value", function () {
      expect(attributes.read(target, 'nested|test', '|')).toEqual(1);
    });
  });
  describe("and the property does not exist", function () {
    it("should be undefined", function () {
      expect(attributes.read(target, 'another|key', '|')).toEqual(undefined);
    });
  });
});

},{"./../../../lang/attributes":31}],102:[function(require,module,exports){
var connection = require('./../../../lang/connection');

describe('When "getIsSecure is invoked', function () {
  'use strict';

  it('should return true, if passed true', function () {
    expect(connection.getIsSecure(true)).toEqual(true);
  });
  it('should return false, if passed false', function () {
    expect(connection.getIsSecure(false)).toEqual(false);
  });
  it('should return false, if passed undefined', function () {
    expect(connection.getIsSecure(undefined)).toEqual(false);
  });
  it('should return false, if passed null', function () {
    expect(connection.getIsSecure(undefined)).toEqual(false);
  });
});

},{"./../../../lang/connection":32}],103:[function(require,module,exports){
var utilities = require('./../../../lang/date');

describe('When extracting the "short" day of week', function () {
  'use strict';

  const july = 7 - 1;
  it("07/27/2016 should resove to 'Wed'", function () {
    expect(utilities.getShortDay(new Date(2016, july, 27))).toEqual('Wed');
  });
});
describe('When determining the ordinal for a date', function () {
  'use strict';

  const july = 7 - 1;
  it('should return "st" for the first of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 1))).toEqual('st');
  });
  it('should return "nd" for the second of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 2))).toEqual('nd');
  });
  it('should return "rd" for the third of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 3))).toEqual('rd');
  });
  it('should return "th" for the fourth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 4))).toEqual('th');
  });
  it('should return "th" for the fifth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 5))).toEqual('th');
  });
  it('should return "th" for the sixth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 6))).toEqual('th');
  });
  it('should return "th" for the seventh of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 7))).toEqual('th');
  });
  it('should return "th" for the eighth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 8))).toEqual('th');
  });
  it('should return "th" for the ninth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 9))).toEqual('th');
  });
  it('should return "th" for the tenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 10))).toEqual('th');
  });
  it('should return "th" for the eleventh of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 11))).toEqual('th');
  });
  it('should return "th" for the twelfth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 12))).toEqual('th');
  });
  it('should return "th" for the thirteenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 13))).toEqual('th');
  });
  it('should return "th" for the fourteenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 14))).toEqual('th');
  });
  it('should return "th" for the fifteenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 15))).toEqual('th');
  });
  it('should return "th" for the sixteenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 16))).toEqual('th');
  });
  it('should return "th" for the seventeenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 17))).toEqual('th');
  });
  it('should return "th" for the eighteenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 18))).toEqual('th');
  });
  it('should return "th" for the nineteenth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 19))).toEqual('th');
  });
  it('should return "th" for the twentieth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 20))).toEqual('th');
  });
  it('should return "th" for the twenty first of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 21))).toEqual('st');
  });
  it('should return "th" for the twenty second of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 22))).toEqual('nd');
  });
  it('should return "th" for the twenty third of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 23))).toEqual('rd');
  });
  it('should return "th" for the twenty fourth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 24))).toEqual('th');
  });
  it('should return "th" for the twenty fifth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 25))).toEqual('th');
  });
  it('should return "th" for the twenty sixth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 26))).toEqual('th');
  });
  it('should return "th" for the twenty seventh of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 27))).toEqual('th');
  });
  it('should return "th" for the twenty eighth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 28))).toEqual('th');
  });
  it('should return "th" for the twenty ninth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 29))).toEqual('th');
  });
  it('should return "th" for the thirtieth of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 30))).toEqual('th');
  });
  it('should return "th" for the thirty first of the month', function () {
    expect(utilities.getDateOrdinal(new Date(2017, july, 31))).toEqual('st');
  });
});

},{"./../../../lang/date":33}],104:[function(require,module,exports){
var formatter = require('./../../../lang/formatter');

describe('When formatting numbers', function () {
  'use strict';

  it('formatting 123 with six digits (no separator, no parenthesis)', function () {
    expect(formatter.numberToString(123, 6)).toEqual('123.000000');
  });
});

},{"./../../../lang/formatter":34}],105:[function(require,module,exports){
var functions = require('./../../../lang/functions');

describe('when using the tautology function', function () {
  'use strict';

  var tautology;
  beforeEach(function () {
    tautology = functions.getTautology();
  });
  it('if null is passed, null should be returned', function () {
    expect(tautology(null)).toEqual(null);
  });
  it('if undefined is passed, undefined should be returned', function () {
    expect(tautology(undefined)).toEqual(undefined);
  });
  it('if Math.PI is passed, Math.PI should be returned', function () {
    expect(tautology(Math.PI)).toEqual(Math.PI);
  });
  it('if an object is passed, the object should be returned', function () {
    var x;
    expect(tautology(x = {})).toBe(x);
  });
});

},{"./../../../lang/functions":35}],106:[function(require,module,exports){
var is = require('./../../../lang/is');

describe('When checking the number 3', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = 3;
  });
  it("it should be a number", function () {
    expect(is.number(candidate)).toEqual(true);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should be an integer", function () {
    expect(is.integer(candidate)).toEqual(true);
  });
  it("it should be an large integer", function () {
    expect(is.large(candidate)).toEqual(true);
  });
  it("it should be positive", function () {
    expect(is.positive(candidate)).toEqual(true);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking the Math.PI', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = Math.PI;
  });
  it("it should be a number", function () {
    expect(is.number(candidate)).toEqual(true);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should be positive", function () {
    expect(is.positive(candidate)).toEqual(true);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking the Number.NaN', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = Number.NaN;
  });
  it("it should not be a number", function () {
    expect(is.number(candidate)).toEqual(false);
  });
  it("it should be nan", function () {
    expect(is.nan(candidate)).toEqual(true);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should not be positive", function () {
    expect(is.positive(candidate)).toEqual(false);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking the string "3"', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = "3";
  });
  it("it should not be a number", function () {
    expect(is.number(candidate)).toEqual(false);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should not be positive", function () {
    expect(is.positive(candidate)).toEqual(false);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should be a string", function () {
    expect(is.string(candidate)).toEqual(true);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking the date 08/29/2016', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = new Date(2016, 7, 29);
  });
  it("it should not be a number", function () {
    expect(is.number(candidate)).toEqual(false);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should not be positive", function () {
    expect(is.positive(candidate)).toEqual(false);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should be a Date", function () {
    expect(is.date(candidate)).toEqual(true);
  });
  it("it should be an object", function () {
    expect(is.object(candidate)).toEqual(true);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking the "expect" function', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = expect;
  });
  it("it should not be a number", function () {
    expect(is.number(candidate)).toEqual(false);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should not be positive", function () {
    expect(is.positive(candidate)).toEqual(false);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should be a function", function () {
    expect(is.fn(candidate)).toEqual(true);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking an empty object', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = {};
  });
  it("it should not be a number", function () {
    expect(is.number(candidate)).toEqual(false);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should not be positive", function () {
    expect(is.positive(candidate)).toEqual(false);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should be an object", function () {
    expect(is.object(candidate)).toEqual(true);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking a null value', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = null;
  });
  it("it should not be a number", function () {
    expect(is.number(candidate)).toEqual(false);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should not be positive", function () {
    expect(is.positive(candidate)).toEqual(false);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should be null", function () {
    expect(is.null(candidate)).toEqual(true);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});
describe('When checking an undefined value', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = undefined;
  });
  it("it should not be a number", function () {
    expect(is.number(candidate)).toEqual(false);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should not be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should not be an large integer", function () {
    expect(is.large(candidate)).toEqual(false);
  });
  it("it should not be positive", function () {
    expect(is.positive(candidate)).toEqual(false);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should be undefined", function () {
    expect(is.undefined(candidate)).toEqual(true);
  });
});
describe('When checking a large integer (exceeding 32-bits)', function () {
  'use strict';

  var candidate;
  beforeEach(function () {
    candidate = 1502373984424;
  });
  it("it should be a number", function () {
    expect(is.number(candidate)).toEqual(true);
  });
  it("it should not be nan", function () {
    expect(is.nan(candidate)).toEqual(false);
  });
  it("it should be an integer", function () {
    expect(is.integer(candidate)).toEqual(false);
  });
  it("it should be an large integer", function () {
    expect(is.large(candidate)).toEqual(true);
  });
  it("it should be positive", function () {
    expect(is.positive(candidate)).toEqual(true);
  });
  it("it should not be negative", function () {
    expect(is.negative(candidate)).toEqual(false);
  });
  it("it should not be a string", function () {
    expect(is.string(candidate)).toEqual(false);
  });
  it("it should not be a Date", function () {
    expect(is.date(candidate)).toEqual(false);
  });
  it("it should not be a function", function () {
    expect(is.fn(candidate)).toEqual(false);
  });
  it("it should not be an array", function () {
    expect(is.array(candidate)).toEqual(false);
  });
  it("it should not be a boolean", function () {
    expect(is.boolean(candidate)).toEqual(false);
  });
  it("it should not be an object", function () {
    expect(is.object(candidate)).toEqual(false);
  });
  it("it should not be null", function () {
    expect(is.null(candidate)).toEqual(false);
  });
  it("it should not be undefined", function () {
    expect(is.undefined(candidate)).toEqual(false);
  });
});

},{"./../../../lang/is":36}],107:[function(require,module,exports){
var mask = require('./../../../lang/mask');

describe('When testing the suitibility of an bit-based enumeration item', function () {
  it('zero should be valid', function () {
    expect(mask.checkItem(0)).toEqual(true);
  });
  it('one should be valid', function () {
    expect(mask.checkItem(1)).toEqual(true);
  });
  it('two should be valid', function () {
    expect(mask.checkItem(2)).toEqual(true);
  });
  it('three should not be valid', function () {
    expect(mask.checkItem(3)).toEqual(false);
  });
  it('four should be valid', function () {
    expect(mask.checkItem(4)).toEqual(true);
  });
  it('five should not be valid', function () {
    expect(mask.checkItem(5)).toEqual(false);
  });
  it('4095 should not be valid', function () {
    expect(mask.checkItem(4095)).toEqual(false);
  });
  it('4096 should be valid', function () {
    expect(mask.checkItem(4096)).toEqual(true);
  });
  it('4097 should not be valid', function () {
    expect(mask.checkItem(4097)).toEqual(false);
  });
});
describe('When working with an empty flags collection', function () {
  'use strict';

  var FLAG_ONE = 1;
  var FLAG_TWO = 16;
  var FLAG_THREE = 512;
  var flags;
  beforeEach(function () {
    flags = mask.getEmpty();
  });
  it('should not contain flag one', function () {
    expect(mask.has(flags, FLAG_ONE)).toEqual(false);
  });
  it('should not contain flag two', function () {
    expect(mask.has(flags, FLAG_TWO)).toEqual(false);
  });
  it('should not contain flag three', function () {
    expect(mask.has(flags, FLAG_THREE)).toEqual(false);
  });
  describe('and adding the first flag', function () {
    var updated;
    beforeEach(function () {
      updated = mask.add(flags, FLAG_ONE);
    });
    it('should contain flag one', function () {
      expect(mask.has(updated, FLAG_ONE)).toEqual(true);
    });
    it('should not contain flag two', function () {
      expect(mask.has(updated, FLAG_TWO)).toEqual(false);
    });
    it('should not contain flag three', function () {
      expect(mask.has(updated, FLAG_THREE)).toEqual(false);
    });
    describe('and adding the third flag', function () {
      var again;
      beforeEach(function () {
        again = mask.add(updated, FLAG_THREE);
      });
      it('should contain flag one', function () {
        expect(mask.has(again, FLAG_ONE)).toEqual(true);
      });
      it('should not contain flag two', function () {
        expect(mask.has(again, FLAG_TWO)).toEqual(false);
      });
      it('should contain flag three', function () {
        expect(mask.has(again, FLAG_THREE)).toEqual(true);
      });
    });
    describe('and removing the first flag', function () {
      var again;
      beforeEach(function () {
        again = mask.remove(updated, FLAG_ONE);
      });
      it('should be empty', function () {
        expect(again).toEqual(mask.getEmpty());
      });
      it('should not contain flag one', function () {
        expect(mask.has(again, FLAG_ONE)).toEqual(false);
      });
      it('should not contain flag two', function () {
        expect(mask.has(again, FLAG_TWO)).toEqual(false);
      });
      it('should not contain flag three', function () {
        expect(mask.has(again, FLAG_THREE)).toEqual(false);
      });
    });
    describe('and adding the first flag again', function () {
      var again;
      beforeEach(function () {
        again = mask.add(updated, FLAG_ONE);
      });
      it('should be unchanged', function () {
        expect(again).toEqual(updated);
      });
      it('should contain flag one', function () {
        expect(mask.has(again, FLAG_ONE)).toEqual(true);
      });
      it('should not contain flag two', function () {
        expect(mask.has(again, FLAG_TWO)).toEqual(false);
      });
      it('should not contain flag three', function () {
        expect(mask.has(again, FLAG_THREE)).toEqual(false);
      });
    });
  });
});

},{"./../../../lang/mask":37}],108:[function(require,module,exports){
var math = require('./../../../lang/math');

describe('When using math.approximate', function () {
  'use strict';

  describe("and comparing identical integers", function () {
    it("should return true", function () {
      expect(math.approximate(12, 12)).toEqual(true);
    });
  });
  describe("and comparing identical decimals literals", function () {
    it("should return true", function () {
      expect(math.approximate(0.3, 0.3)).toEqual(true);
    });
  });
  describe("and comparing identical derived decimals derived with addition", function () {
    it("should return true", function () {
      expect(math.approximate(0.1 + 0.2, 0.3)).toEqual(true);
    });
  });
  describe("and comparing identical derived decimals derived with division and multiplication", function () {
    it("should return true", function () {
      expect(math.approximate(100.33 / 3 * 3, 100.33)).toEqual(true);
    });
  });
  describe("and comparing an integer with undefined", function () {
    it("should return false", function () {
      expect(math.approximate(123, undefined)).toEqual(false);
    });
  });
  describe("and comparing a decimal with undefined", function () {
    it("should return false", function () {
      expect(math.approximate(123.45, undefined)).toEqual(false);
    });
  });
  describe("and comparing an integer with null", function () {
    it("should return false", function () {
      expect(math.approximate(123, null)).toEqual(false);
    });
  });
  describe("and comparing a decimal with null", function () {
    it("should return false", function () {
      expect(math.approximate(123.45, null)).toEqual(false);
    });
  });
  describe("and comparing strings", function () {
    it("should return false", function () {
      expect(math.approximate('hi', 'there')).toEqual(false);
    });
  });
});

},{"./../../../lang/math":38}],109:[function(require,module,exports){
var memoize = require('./../../../lang/memoize');

describe('When using memoize.simple', function () {
  'use strict';

  describe("on a function that takes a tenth of second to complete", function () {
    var spy;
    var memo;
    var counter;
    beforeEach(function () {
      counter = 0;
      spy = jasmine.createSpy('spy').and.callFake(function (x) {
        counter = counter + 1;
        return counter;
      });
      memo = memoize.simple(spy);
    });
    it('the memoized function should not have been called', function () {
      expect(spy).not.toHaveBeenCalled();
    });
    describe("and the memoized function is called", function () {
      var paramOne;
      var resultOne;
      beforeEach(function () {
        resultOne = memo(paramOne = 'a');
      });
      it('the memoized function to have been called', function () {
        expect(spy.calls.count()).toEqual(1);
      });
      it('the memoized function to have been called with the correct parameters', function () {
        expect(spy).toHaveBeenCalledWith(paramOne);
      });
      it('the result should be a number', function () {
        expect(typeof resultOne).toEqual('number');
      });
      describe("and the memoized function is with the same value again", function () {
        var resultTwo;
        beforeEach(function () {
          resultTwo = memo(paramOne);
        });
        it('the memoized function not to have been called again', function () {
          expect(spy.calls.count()).toEqual(1);
        });
        it('the memoized function should have returned the cached value', function () {
          expect(resultTwo).toEqual(resultOne);
        });
      });
      describe("and the memoized function is called with another value", function () {
        var paramTwo;
        var resultTwo;
        beforeEach(function () {
          resultTwo = memo(paramTwo = 'b');
        });
        it('the memoized function to have been called', function () {
          expect(spy.calls.count()).toEqual(2);
        });
        it('the memoized function to have been called with the correct parameters', function () {
          expect(spy).toHaveBeenCalledWith(paramTwo);
        });
        it('the result should be a number', function () {
          expect(typeof resultTwo).toEqual('number');
        });
      });
    });
  });
});
describe('When using memoize.cache', function () {
  'use strict';

  describe("with a 10 millisecond cache duration", function () {
    var spy;
    var memo;
    var counter;
    beforeEach(function () {
      counter = 0;
      spy = jasmine.createSpy('spy').and.callFake(function (x) {
        counter = counter + 1;
        return counter;
      });
      memo = memoize.cache(spy, 10);
    });
    it('the memoized function should not have been called', function () {
      expect(spy).not.toHaveBeenCalled();
    });
    describe("and the memoized function is called", function () {
      var paramOne;
      var resultOne;
      beforeEach(function () {
        resultOne = memo();
      });
      it('the memoized function to have been called', function () {
        expect(spy.calls.count()).toEqual(1);
      });
      it('the result should be one', function () {
        expect(resultOne).toEqual(1);
      });
      describe("and the memoized function is with the same value again", function () {
        var resultTwo;
        beforeEach(function () {
          resultTwo = memo(paramOne);
        });
        it('the memoized function not to have been called again', function () {
          expect(spy.calls.count()).toEqual(1);
        });
        it('the memoized function should have returned the cached value', function () {
          expect(resultTwo).toEqual(1);
        });
      });
      describe("and the memoized function is called after the cache expires", function () {
        var resultThree;
        beforeEach(function (done) {
          setTimeout(() => {
            resultThree = memo();
            done();
          }, 15);
        });
        it('the memoized function to have been called again', function () {
          expect(spy.calls.count()).toEqual(2);
        });
        it('the result should be two', function () {
          expect(resultThree).toEqual(2);
        });
      });
    });
  });
});

},{"./../../../lang/memoize":39}],110:[function(require,module,exports){
var object = require('./../../../lang/object');

describe('When cloning an object', function () {
  'use strict';

  var target;
  var clone;
  describe('that is empty', function () {
    beforeEach(function () {
      clone = object.clone(target = {});
    });
    it('the clone should be an object', function () {
      expect(typeof clone).toEqual('object');
    });
    it('the clone should not reference the source object', function () {
      expect(clone).not.toBe(target);
    });
  });
  describe('that has a string-based property', function () {
    beforeEach(function () {
      clone = object.clone(target = {
        property: 'hi'
      });
    });
    it('the property value should equal the source property value', function () {
      expect(clone.property).toEqual(target.property);
    });
  });
  describe('that has a number-based property', function () {
    beforeEach(function () {
      clone = object.clone(target = {
        property: 23
      });
    });
    it('the property value should equal the source property value', function () {
      expect(clone.property).toEqual(target.property);
    });
  });
  describe('that has an object-based property', function () {
    beforeEach(function () {
      clone = object.clone(target = {
        property: {}
      });
    });
    it('the clone should be an object', function () {
      expect(typeof clone.property).toEqual('object');
    });
    it('the property value should not be a reference to the property value on the source object', function () {
      expect(clone.property).not.toBe(target.property);
    });
  });
  describe('that has an array-based property', function () {
    beforeEach(function () {
      clone = object.clone(target = {
        property: []
      });
    });
    it('the clone should be an object', function () {
      expect(typeof clone.property).toEqual('object');
    });
    it('the property value should not be a reference to the property value on the source object', function () {
      expect(clone.property).not.toBe(target.property);
    });
  });
});
describe('When merging objects', function () {
  var a;
  var b;
  var merged;
  describe('that are flat', function () {
    beforeEach(function () {
      merged = object.merge(a = {
        a: 1,
        b: 0
      }, b = {
        b: 2,
        z: 26
      });
    });
    it('should not provide a reference to the first source', function () {
      expect(merged).not.toBe(a);
    });
    it('should not provide a reference to the second source', function () {
      expect(merged).not.toBe(b);
    });
    it('should take exclusive properties from the first source', function () {
      expect(merged.a).toEqual(a.a);
    });
    it('should take exclusive properties from the second source', function () {
      expect(merged.z).toEqual(b.z);
    });
    it('should take shared properties from the second source', function () {
      expect(merged.b).toEqual(b.b);
    });
  });
  describe('that have nesting', function () {
    beforeEach(function () {
      merged = object.merge(a = {
        a: {
          a: 1,
          b: 0
        }
      }, b = {
        a: {
          b: 2,
          z: 26
        }
      });
    });
    it('should not provide a reference to the (nested) first source', function () {
      expect(merged.a).not.toBe(a.a);
    });
    it('should not provide a reference to the (nested) second source', function () {
      expect(merged.a).not.toBe(b.a);
    });
    it('should take exclusive properties from the (nested) first source', function () {
      expect(merged.a.a).toEqual(a.a.a);
    });
    it('should take exclusive properties from the (nested) second source', function () {
      expect(merged.a.z).toEqual(b.a.z);
    });
    it('should take shared properties from the (nested) second source', function () {
      expect(merged.a.b).toEqual(b.a.b);
    });
  });
});
describe('When when extracting keys', function () {
  describe('from an object that has "a" and "b" properties', function () {
    var keys;
    beforeEach(function () {
      keys = object.keys({
        a: 1,
        b: 1
      });
    });
    it('should have with two items', function () {
      expect(keys.length).toEqual(2);
    });
    it('should contain an "a" value', function () {
      expect(keys[0] === 'a' || keys[1] === 'a').toEqual(true);
    });
    it('should contain a "b" value', function () {
      expect(keys[0] === 'b' || keys[1] === 'b').toEqual(true);
    });
    it('should not contain a "toString" value', function () {
      expect(keys[0] === 'toString' || keys[1] === 'toString').toEqual(false);
    });
  });
});
describe('When running a deep comparison', function () {
  describe('against two matching strings', function () {
    it('the result should be true', function () {
      expect(object.equals('abc', 'abc')).toEqual(true);
    });
  });
  describe('against two different strings', function () {
    it('the result should be true', function () {
      expect(object.equals('abc', 'xyz')).toEqual(false);
    });
  });
  describe('against an array containing the same strings', function () {
    it('the result should be false', function () {
      expect(object.equals(['a', 'b'], ['a', 'b'])).toEqual(true);
    });
  });
  describe('against an array of different sizes', function () {
    it('the result should be false', function () {
      expect(object.equals(['a', 'b'], ['a', 'b', 'c'])).toEqual(false);
    });
  });
  describe('against objects where one object has an extra property', function () {
    it('the result should be false', function () {
      expect(object.equals({
        first: 'bryan'
      }, {
        first: 'bryan',
        last: 'ingle'
      })).toEqual(false);
    });
  });
  describe('against a complex object, with the same properties and values', function () {
    it('the result should be true', function () {
      var a = {
        hi: {
          my: {
            name: ['Elvis', 'Presley'],
            home: 'Graceland'
          }
        }
      };
      var b = {
        hi: {
          my: {
            name: ['Elvis', 'Presley'],
            home: 'Graceland'
          }
        }
      };
      expect(object.equals(a, b)).toEqual(true);
    });
  });
  describe('against a complex object, with the different properties and values', function () {
    it('the result should be false', function () {
      var a = {
        hi: {
          my: {
            name: ['Elvis', 'Presley'],
            home: 'Graceland'
          }
        }
      };
      var b = {
        hi: {
          my: {
            name: ['Johnny', 'Cash'],
            home: 'Tennessee'
          }
        }
      };
      expect(object.equals(a, b)).toEqual(false);
    });
  });
  describe('against a complex object, where both objects have equals methods (somewhere in the object model tree)', function () {
    it('the result should be true', function () {
      var a = {
        hi: {
          my: {
            name: ['Elvis', 'Presley'],
            home: {
              name: 'Graceland',
              equals: function (other) {
                return other.name === 'Graceland';
              }
            }
          }
        }
      };
      var b = {
        hi: {
          my: {
            name: ['Elvis', 'Presley'],
            home: {
              name: 'Graceland',
              equals: function (other) {
                return other.name === 'Graceland';
              }
            }
          }
        }
      };
      expect(object.equals(a, b)).toEqual(true);
    });
  });
  describe('against two empty arrays', function () {
    it('the result should be true', function () {
      expect(object.equals([], [])).toEqual(true);
    });
  });
});
describe('When cloning a simple object (using a custom value extractor)', function () {
  let source;
  let clone;
  let canExtract;
  let extractor;
  beforeEach(function () {
    source = 42;

    canExtract = value => true;

    extractor = value => ++value;

    clone = object.clone(source, canExtract, extractor);
  });
  it('the cloned object should be 43', function () {
    expect(clone).toBe(43);
  });
});
describe('When cloning a complex object (using a custom value extractor)', function () {
  let source;
  let clone;
  let canExtract;
  let extractor;
  beforeEach(function () {
    source = {
      examples: {
        one: 1,
        two: 2,
        three: 3
      },
      game: {
        name: 'fizz'
      },
      numbers: [0, 1, 2, 3, 4]
    };

    canExtract = value => typeof value === 'number';

    extractor = value => value > 0 && value % 3 === 0 ? 'fizz' : value;

    clone = object.clone(source, canExtract, extractor);
  });
  it('the cloned object should not be the source object', function () {
    expect(clone).not.toBe(source);
  });
  it("the clone object's child objects should not be the same", function () {
    expect(clone.examples).not.toBe(source.examples);
    expect(clone.game).not.toBe(source.game);
  });
  it("the clone object's child arrays should not be the same", function () {
    expect(clone.numbers).not.toBe(source.numbers);
  });
  it('the numbers divisible by three should be replaced with "fizz" (for object properties)', function () {
    expect(clone.examples.three).toEqual('fizz');
    expect(clone.numbers[3]).toEqual('fizz');
  });
  it('the numbers not divisible should be the same value (for object properties)', function () {
    expect(clone.examples.one).toEqual(1);
    expect(clone.examples.two).toEqual(2);
    expect(clone.numbers[0]).toEqual(0);
    expect(clone.numbers[1]).toEqual(1);
    expect(clone.numbers[2]).toEqual(2);
    expect(clone.numbers[4]).toEqual(4);
  });
});

},{"./../../../lang/object":40}],111:[function(require,module,exports){
var promise = require('./../../../lang/promise');

describe('When a timeout is set for a promise', function () {
  'use strict';

  describe('on a promise that has already been resolved', function () {
    var originalPromise;
    var timeoutPromise;
    var result;
    beforeEach(function () {
      originalPromise = Promise.resolve(result = 'instant');
      timeoutPromise = promise.timeout(originalPromise, 10);
    });
    it('it will resolve', function (done) {
      timeoutPromise.then(function (r) {
        expect(r).toBe(result);
        done();
      });
    });
  });
  describe('on a promise that has already been rejected', function () {
    var originalPromise;
    var timeoutPromise;
    var result;
    beforeEach(function () {
      originalPromise = Promise.reject(result = 'instant');
      timeoutPromise = promise.timeout(originalPromise, 10);
    });
    it('it reject normally', function (done) {
      timeoutPromise.catch(function (r) {
        expect(r).toBe(result);
        done();
      });
    });
  });
  describe('on a promise that resolves quickly', function () {
    var originalPromise;
    var timeoutPromise;
    var result;
    beforeEach(function () {
      originalPromise = new Promise(function (resolveCallback, rejectCallback) {
        setTimeout(function () {
          resolveCallback(result = 'quick');
        }, 5);
      });
      timeoutPromise = promise.timeout(originalPromise, 10);
    });
    it('it will resolve', function (done) {
      timeoutPromise.then(function (r) {
        expect(r).toBe(result);
        done();
      });
    });
  });
  describe('on a promise that rejects quickly', function () {
    var originalPromise;
    var timeoutPromise;
    var result;
    beforeEach(function () {
      originalPromise = new Promise(function (resolveCallback, rejectCallback) {
        setTimeout(function () {
          rejectCallback(result = 'quick');
        }, 5);
      });
      timeoutPromise = promise.timeout(originalPromise, 10);
    });
    it('it reject normally', function (done) {
      timeoutPromise.catch(function (r) {
        expect(r).toBe(result);
        done();
      });
    });
  });
  describe('on a promise that resolves slowly', function () {
    var originalPromise;
    var timeoutPromise;
    var result;
    beforeEach(function () {
      originalPromise = new Promise(function (resolveCallback, rejectCallback) {
        setTimeout(function () {
          resolveCallback(result = 'slow');
        }, 20);
      });
      timeoutPromise = promise.timeout(originalPromise, 10);
    });
    it('will reject due to timeout', function (done) {
      timeoutPromise.catch(function () {
        expect(true).toBe(true);
        done();
      });
    });
  });
  describe('on a promise that rejects slowly', function () {
    var originalPromise;
    var timeoutPromise;
    var result;
    beforeEach(function () {
      originalPromise = new Promise(function (resolveCallback, rejectCallback) {
        setTimeout(function () {
          rejectCallback(result = 'slow');
        }, 20);
      });
      timeoutPromise = promise.timeout(originalPromise, 10);
    });
    it('it reject normally', function (done) {
      timeoutPromise.catch(function (r) {
        expect(r).not.toBe(result);
        done();
      });
    });
  });
  describe('on a promise that will never resolve', function () {
    var originalPromise;
    var timeoutPromise;
    beforeEach(function () {
      originalPromise = new Promise(function (resolveCallback, rejectCallback) {
        return;
      });
      timeoutPromise = promise.timeout(originalPromise, 10);
    });
    it('will reject due to timeout', function (done) {
      timeoutPromise.catch(function () {
        expect(true).toBe(true);
        done();
      });
    });
  });
});
describe('When using the "promise.map" function', function () {
  'use strict';

  describe('with an asynchronous, promise-based mapper', function () {
    describe('and the array has zero items', function () {
      var mapPromise;
      var mapItems;
      var mapSpy;
      beforeEach(function () {
        mapItems = [];
      });
      describe('and the concurrency level is zero', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = jasmine.createSpy('mapSpy'), 0);
        });
        it('the result should be an empty array', function (done) {
          mapPromise.then(function (results) {
            expect(results.length).toEqual(0);
            done();
          });
        });
        it('the mapping function should not have been called', function (done) {
          mapPromise.then(function (results) {
            expect(mapSpy).not.toHaveBeenCalled();
            done();
          });
        });
      });
      describe('and the concurrency level is six', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = jasmine.createSpy('mapSpy'), 6);
        });
        it('the result should be an empty array', function (done) {
          mapPromise.then(function (results) {
            expect(results.length).toEqual(0);
            done();
          });
        });
        it('the mapping function should not have been called', function (done) {
          mapPromise.then(function (results) {
            expect(mapSpy).not.toHaveBeenCalled();
            done();
          });
        });
      });
    });
    describe('and the array has three items', function () {
      var mapPromise;
      var mapItems;
      var mapSpy;
      var first;
      var second;
      var third;
      beforeEach(function () {
        mapItems = [first = {}, second = {}, third = {}];
      });
      describe('and the concurrency level is zero', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = getMapSpy(), 0);
        });
        it('the maximum concurrency level should be three', function (done) {
          mapPromise.then(function (results) {
            expect(getMaximumConcurrency(results)).toEqual(3);
            done();
          });
        });
        it('the actual concurrency for the first item should be three', function (done) {
          mapPromise.then(function (results) {
            expect(getConcurrency(results, 0)).toEqual(3);
            done();
          });
        });
        it('the result for the first item should be first', function (done) {
          mapPromise.then(function (results) {
            expect(results[0].item).toBe(first);
            done();
          });
        });
        it('the result for the second item should be second', function (done) {
          mapPromise.then(function (results) {
            expect(results[1].item).toBe(second);
            done();
          });
        });
        it('the result for the third item should be third', function (done) {
          mapPromise.then(function (results) {
            expect(results[2].item).toBe(third);
            done();
          });
        });
      });
      describe('and the concurrency level is one', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = getMapSpy(), 1);
        });
        it('the maximum concurrency level should be one', function (done) {
          mapPromise.then(function (results) {
            expect(getMaximumConcurrency(results)).toEqual(1);
            done();
          });
        });
        it('the actual concurrency for the first item should be one', function (done) {
          mapPromise.then(function (results) {
            expect(getConcurrency(results, 0)).toEqual(1);
            done();
          });
        });
        it('the result for the first item should be first', function (done) {
          mapPromise.then(function (results) {
            expect(results[0].item).toBe(first);
            done();
          });
        });
        it('the result for the second item should be second', function (done) {
          mapPromise.then(function (results) {
            expect(results[1].item).toBe(second);
            done();
          });
        });
        it('the result for the third item should be third', function (done) {
          mapPromise.then(function (results) {
            expect(results[2].item).toBe(third);
            done();
          });
        });
      });
      describe('and the concurrency level is two', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = getMapSpy(), 2);
        });
        it('the maximum concurrency level should be two', function (done) {
          mapPromise.then(function (results) {
            expect(getMaximumConcurrency(results)).toEqual(2);
            done();
          });
        });
        it('the actual concurrency for the first item should be two', function (done) {
          mapPromise.then(function (results) {
            expect(getConcurrency(results, 0)).toEqual(2);
            done();
          });
        });
        it('the result for the first item should be first', function (done) {
          mapPromise.then(function (results) {
            expect(results[0].item).toBe(first);
            done();
          });
        });
        it('the result for the second item should be second', function (done) {
          mapPromise.then(function (results) {
            expect(results[1].item).toBe(second);
            done();
          });
        });
        it('the result for the third item should be third', function (done) {
          mapPromise.then(function (results) {
            expect(results[2].item).toBe(third);
            done();
          });
        });
      });
      describe('and the concurrency level is three', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = getMapSpy(), 3);
        });
        it('the maximum concurrency level should be three', function (done) {
          mapPromise.then(function (results) {
            expect(getMaximumConcurrency(results)).toEqual(3);
            done();
          });
        });
        it('the actual concurrency for the first item should be three', function (done) {
          mapPromise.then(function (results) {
            expect(getConcurrency(results, 0)).toEqual(3);
            done();
          });
        });
        it('the result for the first item should be first', function (done) {
          mapPromise.then(function (results) {
            expect(results[0].item).toBe(first);
            done();
          });
        });
        it('the result for the second item should be second', function (done) {
          mapPromise.then(function (results) {
            expect(results[1].item).toBe(second);
            done();
          });
        });
        it('the result for the third item should be third', function (done) {
          mapPromise.then(function (results) {
            expect(results[2].item).toBe(third);
            done();
          });
        });
      });
      describe('and the concurrency level is four', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = getMapSpy(), 4);
        });
        it('the maximum concurrency level should be three', function (done) {
          mapPromise.then(function (results) {
            expect(getMaximumConcurrency(results)).toEqual(3);
            done();
          });
        });
        it('the actual concurrency for the first item should be three', function (done) {
          mapPromise.then(function (results) {
            expect(getConcurrency(results, 0)).toEqual(3);
            done();
          });
        });
        it('the result for the first item should be first', function (done) {
          mapPromise.then(function (results) {
            expect(results[0].item).toBe(first);
            done();
          });
        });
        it('the result for the second item should be second', function (done) {
          mapPromise.then(function (results) {
            expect(results[1].item).toBe(second);
            done();
          });
        });
        it('the result for the third item should be third', function (done) {
          mapPromise.then(function (results) {
            expect(results[2].item).toBe(third);
            done();
          });
        });
      });
    });
    describe('and the array has four items (with a concurrency level of two)', function () {
      var mapPromise;
      var mapItems;
      var mapSpy;
      var first;
      var second;
      var third;
      var fourth;
      beforeEach(function () {
        mapItems = [first = {}, second = {}, third = {}, fourth = {}];
      });
      describe('and the first item takes a long time to process', function () {
        beforeEach(function () {
          mapPromise = promise.map(mapItems, mapSpy = jasmine.createSpy('mapSpy').and.callFake(function (item) {
            var delay;

            if (item === first) {
              delay = 30;
            } else {
              delay = 5;
            }

            var startDate = new Date();
            return new Promise(function (resolveCallback, rejectCallback) {
              setTimeout(function () {
                var endDate = new Date();
                resolveCallback({
                  item: item,
                  start: startDate.getTime(),
                  end: endDate.getTime()
                });
              }, delay);
            });
          }), 2);
        });
        it('the result for the first item should be first', function (done) {
          mapPromise.then(function (results) {
            expect(results[0].item).toBe(first);
            done();
          });
        });
        it('the result for the second item should be second', function (done) {
          mapPromise.then(function (results) {
            expect(results[1].item).toBe(second);
            done();
          });
        });
        it('the result for the third item should be third', function (done) {
          mapPromise.then(function (results) {
            expect(results[2].item).toBe(third);
            done();
          });
        });
        it('the result for the fourth item should be fourth', function (done) {
          mapPromise.then(function (results) {
            expect(results[3].item).toBe(fourth);
            done();
          });
        });
      });
    });

    var getMapSpy = function () {
      return jasmine.createSpy('mapSpy').and.callFake(function (item) {
        var startDate = new Date();
        return new Promise(function (resolveCallback, rejectCallback) {
          setTimeout(function () {
            var endDate = new Date();
            resolveCallback({
              item: item,
              start: startDate.getTime(),
              end: endDate.getTime()
            });
          }, 5);
        });
      });
    };
  });
  describe('with an synchronous mapper', function () {
    describe('and the array has no items (with an infinite concurrency level)', function () {
      var mapPromise;
      var mapItems;
      var mapSpy;
      beforeEach(function () {
        mapPromise = promise.map(mapItems = [], mapSpy = jasmine.createSpy('mapSpy'));
      });
      it('the result will be an array', function (done) {
        mapPromise.then(function (results) {
          expect(results instanceof Array).toEqual(true);
          done();
        });
      });
      it('the resulting array will be the same size as the input array', function (done) {
        mapPromise.then(function (results) {
          expect(results.length).toEqual(mapItems.length);
          done();
        });
      });
      it('the mapper function will be not have been called', function (done) {
        mapPromise.then(function (results) {
          expect(mapSpy.calls.count()).toEqual(0);
          done();
        });
      });
    });
    describe('and the array has two items (with an infinite concurrency level)', function () {
      var mapPromise;
      var mapItems;
      var mapSpy;
      beforeEach(function () {
        mapPromise = promise.map(mapItems = ['x', 'y'], mapSpy = jasmine.createSpy('mapSpy'));
      });
      it('the result will be an array', function (done) {
        mapPromise.then(function (results) {
          expect(results instanceof Array).toEqual(true);
          done();
        });
      });
      it('the resulting array have two items', function (done) {
        mapPromise.then(function (results) {
          expect(results.length).toEqual(2);
          done();
        });
      });
      it('the mapper function to have been called twice', function (done) {
        mapPromise.then(function (results) {
          expect(mapSpy.calls.count()).toEqual(2);
          done();
        });
      });
      it('the mapper function will have been called once with the first item', function (done) {
        mapPromise.then(function (results) {
          expect(mapSpy).toHaveBeenCalledWith(mapItems[0]);
          done();
        });
      });
      it('the mapper function will have been called once with the second item', function (done) {
        mapPromise.then(function (results) {
          expect(mapSpy).toHaveBeenCalledWith(mapItems[1]);
          done();
        });
      });
    });
  });

  var getConcurrency = function (results, index) {
    var current = results[index];
    var concurrency = 0;

    for (var i = 0; i < results.length; i++) {
      var other = results[i];

      if (!(other.end <= current.start || other.start >= current.end)) {
        concurrency = concurrency + 1;
      }
    }

    return concurrency;
  };

  var getMaximumConcurrency = function (results) {
    var maximum = 0;

    for (var i = 0; i < results.length; i++) {
      maximum = Math.max(getConcurrency(results, i), maximum);
    }

    return maximum;
  };
});
describe('When processing a "pipeline" of promises', function () {
  'use strict';

  describe('and no executors are specified', function () {
    var input;
    var p;
    beforeEach(function () {
      p = promise.pipeline([], input = {});
    });
    it('should return the original input', function (done) {
      p.then(function (result) {
        expect(result).toBe(input);
        done();
      });
    });
  });
  describe('and one asynchronous executor is specified', function () {
    var input;
    var spyOne;
    var p;
    beforeEach(function () {
      var delayedSquare = function (x) {
        return new Promise(resolveCallback => {
          setTimeout(function () {
            resolveCallback(x * x);
          }, 10);
        });
      };

      spyOne = jasmine.createSpy('spyOne').and.callFake(delayedSquare);
      p = promise.pipeline([spyOne], input = 2);
    });
    it('the first executor should be called with the input', function (done) {
      p.then(function (result) {
        expect(spyOne).toHaveBeenCalledWith(2);
        done();
      });
    });
    it('the promise should return the correct result', function (done) {
      p.then(function (result) {
        expect(result).toEqual(4);
        done();
      });
    });
  });
  describe('and two asynchronous executors are specified', function () {
    var input;
    var spyOne;
    var spyTwo;
    var p;
    beforeEach(function () {
      var delayedSquare = function (x) {
        return new Promise(resolveCallback => {
          setTimeout(function () {
            resolveCallback(x * x);
          }, 10);
        });
      };

      spyOne = jasmine.createSpy('spyOne').and.callFake(delayedSquare);
      spyTwo = jasmine.createSpy('spyTwo').and.callFake(delayedSquare);
      p = promise.pipeline([spyOne, spyTwo], input = 2);
    });
    it('the first executor should be called with the input', function (done) {
      p.then(function (result) {
        expect(spyOne).toHaveBeenCalledWith(2);
        done();
      });
    });
    it('the second executor should be called with the result of the first executor', function (done) {
      p.then(function (result) {
        expect(spyTwo).toHaveBeenCalledWith(4);
        done();
      });
    });
    it('the promise should return the correct result', function (done) {
      p.then(function (result) {
        expect(result).toEqual(16);
        done();
      });
    });
  });
  describe('and one synchronous executor is specified', function () {
    var input;
    var spyOne;
    var p;
    beforeEach(function () {
      var synchronousSquare = function (x) {
        return x * x;
      };

      spyOne = jasmine.createSpy('spyOne').and.callFake(synchronousSquare);
      p = promise.pipeline([spyOne], input = 2);
    });
    it('the first executor should be called with the input', function (done) {
      p.then(function (result) {
        expect(spyOne).toHaveBeenCalledWith(2);
        done();
      });
    });
    it('the promise should return the correct result', function (done) {
      p.then(function (result) {
        expect(result).toEqual(4);
        done();
      });
    });
  });
  describe('and two synchronous executors are specified', function () {
    var input;
    var spyOne;
    var spyTwo;
    var p;
    beforeEach(function () {
      var synchronousSquare = function (x) {
        return x * x;
      };

      spyOne = jasmine.createSpy('spyOne').and.callFake(synchronousSquare);
      spyTwo = jasmine.createSpy('spyTwo').and.callFake(synchronousSquare);
      p = promise.pipeline([spyOne, spyTwo], input = 2);
    });
    it('the first executor should be called with the input', function (done) {
      p.then(function (result) {
        expect(spyOne).toHaveBeenCalledWith(2);
        done();
      });
    });
    it('the second executor should be called with the result of the first executor', function (done) {
      p.then(function (result) {
        expect(spyTwo).toHaveBeenCalledWith(4);
        done();
      });
    });
    it('the promise should return the correct result', function (done) {
      p.then(function (result) {
        expect(result).toEqual(16);
        done();
      });
    });
  });
  describe('and an executor throws an exception', function () {
    var input;
    var spyOne;
    var spyTwo;
    var p;
    beforeEach(function () {
      var synchronousException = function (x) {
        throw new Exception('oops');
      };

      var synchronousSquare = function (x) {
        return x * x;
      };

      spyOne = jasmine.createSpy('spyOne').and.callFake(synchronousException);
      spyTwo = jasmine.createSpy('spyTwo').and.callFake(synchronousSquare);
      p = promise.pipeline([spyOne, spyTwo], input = 2);
    });
    it('the promise should reject', function (done) {
      p.catch(function (error) {
        expect(error instanceof Error).toEqual(true);
        done();
      });
    });
    it('the first executor should be called with the input', function (done) {
      p.catch(function (error) {
        expect(spyOne).toHaveBeenCalledWith(2);
        done();
      });
    });
    it('the second executor not have should be called with the result of the first executor', function (done) {
      p.catch(function (error) {
        expect(spyTwo).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
describe('When "promise.build" is used to create a promise', function () {
  'use strict';

  describe('and the executor resolves', function () {
    var p;
    beforeEach(function () {
      p = promise.build(function (r, x) {
        r('ok');
      });
    });
    it('the promise should be fulfilled', function (done) {
      p.then(function (result) {
        expect(result).toEqual('ok');
        done();
      });
    });
  });
  describe('and the executor rejects', function () {
    var p;
    beforeEach(function () {
      p = promise.build(function (r, x) {
        x('not ok');
      });
    });
    it('the promise should be fulfilled', function (done) {
      p.catch(function (result) {
        expect(result).toEqual('not ok');
        done();
      });
    });
  });
  describe('and the executor throws an error', function () {
    var p;
    var e;
    beforeEach(function () {
      p = promise.build(function (r, x) {
        e = new Error('oops');
        throw e;
      });
    });
    it('the promise should be rejected', function (done) {
      p.catch(function (error) {
        expect(error).toBe(e);
        done();
      });
    });
  });
});

},{"./../../../lang/promise":41}],112:[function(require,module,exports){
var random = require('./../../../lang/random');

describe('When generating a random number, restricting the range to one integer', function () {
  'use strict';

  var result;
  var value;
  beforeEach(function () {
    result = random.range(value = 42, value);
  });
  it('should be the value', function () {
    expect(result).toEqual(value);
  });
});
describe('When generating a random number with a range of multiple values', function () {
  'use strict';

  var result;
  var minimum;
  var maximum;
  beforeEach(function () {
    minimum = -2;
    maximum = 1;
  });
  it('should generate a value within the range', function () {
    var range = maximum - minimum;

    for (var i = 0; i < range * 10; i++) {
      var result = random.range(minimum, maximum);
      expect(result < minimum).toEqual(false);
      expect(result > maximum).toEqual(false);
    }
  });
});

},{"./../../../lang/random":42}],113:[function(require,module,exports){
var string = require('./../../../lang/string');

describe('When converting a string to "start" casing', function () {
  'use strict';

  var result;
  beforeEach(function () {
    result = string.startCase('The quick brown Fox');
  });
  it('should convert the first character (after each space) to a capital letter', function () {
    expect(result).toEqual('The Quick Brown Fox');
  });
});
describe('When truncating a string', function () {
  'use strict';

  var base;
  beforeEach(function () {
    base = '1234567890';
  });
  describe('to more characters than the base string', function () {
    var result;
    beforeEach(function () {
      result = string.truncate(base, base.length + 1);
    });
    it('should return the base string', function () {
      expect(result).toEqual(base);
    });
  });
  describe('to the same number of characters than the base string', function () {
    var result;
    beforeEach(function () {
      result = string.truncate(base, base.length);
    });
    it('should return the base string', function () {
      expect(result).toEqual(base);
    });
  });
  describe('to fewer characters than the base string', function () {
    var result;
    var length;
    beforeEach(function () {
      result = string.truncate(base, length = 2);
    });
    it('the result should be the correct number of characters', function () {
      expect(result.length).toEqual(length + 4);
    });
    it('the first characters should be from the base string', function () {
      for (var i = 0; i < length; i++) {
        expect(result.substring(i, i + 1)).toEqual(base.substring(i, i + 1));
      }
    });
    it('the final characters should be the base string', function () {
      expect(result.substring(result.length - 4, result.length)).toEqual(' ...');
    });
  });
});
describe('When left padding a string', function () {
  'use strict';

  var base;
  beforeEach(function () {
    base = 'base';
  });
  describe('with fewer characters than the base string', function () {
    var result;
    beforeEach(function () {
      result = string.padLeft(base, base.length, 'x');
    });
    it('should return the base string', function () {
      expect(result).toEqual(base);
    });
  });
  describe('with one more character than the base string', function () {
    var result;
    var repeat;
    beforeEach(function () {
      result = string.padLeft(base, base.length + 1, repeat = 'x');
    });
    it('the result should be the correct number of characters', function () {
      expect(result.length).toEqual(base.length + 1);
    });
    it('the first character should be the repeating character', function () {
      expect(result.substring(0, 1)).toEqual(repeat);
    });
    it('the final characters should be the base string', function () {
      expect(result.substring(1, result.length)).toEqual(base);
    });
  });
  describe('with many more character than the base string', function () {
    var result;
    var repeat;
    var count;
    beforeEach(function () {
      result = string.padLeft(base, count = 10, repeat = 'x');
    });
    it('the result should be the correct number of characters', function () {
      expect(result.length).toEqual(count);
    });
    it('the first characters should be the repeating character', function () {
      var prefix = count - base.length;

      for (var i = 0; i < prefix; i++) {
        expect(result.substring(i, i + 1)).toEqual(repeat);
      }
    });
    it('the final characters should be the base string', function () {
      expect(result.substring(count - base.length, result.length)).toEqual(base);
    });
  });
});
describe('When a formattable string ("&startDate={0}&endDate={1}"', function () {
  'use strict';

  var stringToFormat;
  beforeEach(function () {
    stringToFormat = '&startDate={0}&endDate={1}';
  });
  it('formatted with ("2017-08-31" and  "2017-09-30")', function () {
    expect(string.format(stringToFormat, '2017-08-31', '2017-09-30')).toEqual('&startDate=2017-08-31&endDate=2017-09-30');
  });
  it('formatted with ("0" and  "0")', function () {
    expect(string.format(stringToFormat, 0, 0)).toEqual('&startDate=0&endDate=0');
  });
  it('formatted with ("hello")', function () {
    expect(string.format(stringToFormat, 'hello')).toEqual('&startDate=hello&endDate={1}');
  });
  it('formatted with ("xin" and "bryan" and "dave")', function () {
    expect(string.format(stringToFormat, 'xin', 'bryan', 'dave')).toEqual('&startDate=xin&endDate=bryan');
  });
  it('formatted with nothing', function () {
    expect(string.format(stringToFormat)).toEqual('&startDate={0}&endDate={1}');
  });
});

},{"./../../../lang/string":43}],114:[function(require,module,exports){
var EventMap = require('./../../../messaging/EventMap');

describe('When an EventMap is constructed', function () {
  'use strict';

  var eventMap;
  beforeEach(function () {
    eventMap = new EventMap();
  });
  describe('and a handler is registered', function () {
    var eventName;
    var eventHandler;
    beforeEach(function () {
      eventMap.register(eventName = 'hi', eventHandler = jasmine.createSpy('eventHandler'));
    });
    it('should report the event as not empty', function () {
      expect(eventMap.getIsEmpty(eventName)).toBe(false);
    });
    describe('and the event fires', function () {
      var eventData;
      beforeEach(function () {
        eventMap.fire(eventName, eventData = {});
      });
      it('should notify the handler', function () {
        expect(eventHandler).toHaveBeenCalledWith(eventData, eventMap);
      });
    });
    describe('and the an unrelated event fires', function () {
      var eventData;
      beforeEach(function () {
        eventMap.fire('blah', eventData = {});
      });
      it('should not notify the handler', function () {
        expect(eventHandler).not.toHaveBeenCalled();
      });
    });
    describe('and the handler is unregistered', function () {
      beforeEach(function () {
        eventMap.unregister(eventName, eventHandler);
      });
      it('should report the event as empty', function () {
        expect(eventMap.getIsEmpty(eventName)).toBe(true);
      });
    });
    describe('and the handler is unregistered (using the wrong event name)', function () {
      beforeEach(function () {
        eventMap.unregister('blah', eventHandler);
      });
      it('should not report the event as empty', function () {
        expect(eventMap.getIsEmpty(eventName)).toBe(false);
      });
    });
    describe('and the handler is unregistered (using the wrong handler)', function () {
      beforeEach(function () {
        eventMap.unregister(eventName, function () {});
      });
      it('should not report the event as empty', function () {
        expect(eventMap.getIsEmpty(eventName)).toBe(false);
      });
    });
    describe('and another handler is registered', function () {
      var eventHandlerTwo;
      beforeEach(function () {
        eventMap.register(eventName, eventHandlerTwo = jasmine.createSpy('eventHandlerTwo'));
      });
      it('should report the event as not empty', function () {
        expect(eventMap.getIsEmpty(eventName)).toBe(false);
      });
      describe('and the event fires', function () {
        var eventData;
        beforeEach(function () {
          eventMap.fire(eventName, eventData = {});
        });
        it('should notify the first handler', function () {
          expect(eventHandler).toHaveBeenCalledWith(eventData, eventMap);
        });
        it('should notify the second handler', function () {
          expect(eventHandlerTwo).toHaveBeenCalledWith(eventData, eventMap);
        });
      });
      describe('and the an unrelated event fires', function () {
        var eventData;
        beforeEach(function () {
          eventMap.fire('blah', eventData = {});
        });
        it('should not notify the first handler', function () {
          expect(eventHandler).not.toHaveBeenCalled();
        });
        it('should not notify the second handler', function () {
          expect(eventHandlerTwo).not.toHaveBeenCalled();
        });
      });
      describe('and the handler is unregistered', function () {
        beforeEach(function () {
          eventMap.unregister(eventName, eventHandler);
        });
        it('should report the event as empty', function () {
          expect(eventMap.getIsEmpty(eventName)).toBe(false);
        });
        describe('and the event fires', function () {
          var eventData;
          beforeEach(function () {
            eventMap.fire(eventName, eventData = {});
          });
          it('should not notify the first handler', function () {
            expect(eventHandler).not.toHaveBeenCalledWith(eventData, eventMap);
          });
          it('should notify the second handler', function () {
            expect(eventHandlerTwo).toHaveBeenCalledWith(eventData, eventMap);
          });
        });
        describe('and the second handler is unregistered', function () {
          beforeEach(function () {
            eventMap.unregister(eventName, eventHandlerTwo);
          });
          it('should report the event as empty', function () {
            expect(eventMap.getIsEmpty(eventName)).toBe(true);
          });
          describe('and the event fires', function () {
            var eventData;
            beforeEach(function () {
              eventMap.fire(eventName, eventData = {});
            });
            it('should not notify the first handler', function () {
              expect(eventHandler).not.toHaveBeenCalledWith(eventData, eventMap);
            });
            it('should not notify the second handler', function () {
              expect(eventHandlerTwo).not.toHaveBeenCalledWith(eventData, eventMap);
            });
          });
        });
      });
    });
  });
});

},{"./../../../messaging/EventMap":46}],115:[function(require,module,exports){
var Disposable = require('./../../../lang/Disposable');

var Event = require('./../../../messaging/Event');

describe('When an Event is constructed', function () {
  'use strict';

  var event;
  var context;
  beforeEach(function () {
    event = new Event(context = {});
  });
  describe('and an event handler is registered', function () {
    var spyOne;
    var bindingOne;
    beforeEach(function () {
      bindingOne = event.register(spyOne = jasmine.createSpy('spyOne'));
    });
    it('should return a Disposable instance', function () {
      expect(bindingOne instanceof Disposable).toEqual(true);
    });
    describe('and the event fires', function () {
      var data;
      beforeEach(function () {
        event.fire(data = {});
      });
      it('should notify the observer', function () {
        expect(spyOne).toHaveBeenCalledWith(context, data);
      });
    });
    describe('and another event handler is registered', function () {
      var spyTwo;
      var bindingTwo;
      beforeEach(function () {
        bindingTwo = event.register(spyTwo = jasmine.createSpy('spyTwo'));
      });
      it('should return a Disposable instance', function () {
        expect(bindingTwo instanceof Disposable).toEqual(true);
      });
      describe('and the event fires', function () {
        var data;
        beforeEach(function () {
          event.fire(data = {});
        });
        it('should notify both observers', function () {
          expect(spyOne).toHaveBeenCalledWith(context, data);
          expect(spyTwo).toHaveBeenCalledWith(context, data);
        });
      });
      describe('and the first observer is disposed ', function () {
        var data;
        beforeEach(function () {
          bindingOne.dispose();
        });
        describe('and the event fires', function () {
          var data;
          beforeEach(function () {
            event.fire(data = {});
          });
          it('should not notify the first observer', function () {
            expect(spyOne).not.toHaveBeenCalledWith(context, data);
          });
          it('should notify the second observer', function () {
            expect(spyTwo).toHaveBeenCalledWith(context, data);
          });
        });
      });
    });
  });
  describe('and multiple observers are added which dispose themselves', function () {
    var spyOne;
    var spyTwo;
    var bindingOne;
    var bindingTwo;
    beforeEach(function () {
      bindingOne = event.register(spyOne = jasmine.createSpy('spyOne').and.callFake(function () {
        bindingOne.dispose();
      }));
      bindingTwo = event.register(spyTwo = jasmine.createSpy('spyTwo').and.callFake(function () {
        bindingTwo.dispose();
      }));
    });
    describe('and the event fires', function () {
      var data;
      beforeEach(function () {
        event.fire(data = {});
      });
      it('should notify both observer', function () {
        expect(spyOne).toHaveBeenCalledWith(context, data);
        expect(spyTwo).toHaveBeenCalledWith(context, data);
      });
      describe('and the event fires again', function () {
        var data;
        beforeEach(function () {
          spyOne.calls.reset();
          spyTwo.calls.reset();
          event.fire(data = {});
        });
        it('should not notify either observer', function () {
          expect(spyOne).not.toHaveBeenCalledWith(context, data);
          expect(spyTwo).not.toHaveBeenCalledWith(context, data);
        });
      });
    });
  });
  describe('and two observers are added which dispose each other', function () {
    var spyOne;
    var spyTwo;
    var bindingOne;
    var bindingTwo;
    beforeEach(function () {
      bindingOne = event.register(spyOne = jasmine.createSpy('spyOne').and.callFake(function () {
        bindingTwo.dispose();
      }));
      bindingTwo = event.register(spyTwo = jasmine.createSpy('spyTwo').and.callFake(function () {
        bindingOne.dispose();
      }));
    });
    describe('and the event fires', function () {
      var data;
      beforeEach(function () {
        event.fire(data = {});
      });
      it('should notify both observer', function () {
        expect(spyOne).toHaveBeenCalledWith(context, data);
        expect(spyTwo).toHaveBeenCalledWith(context, data);
      });
      describe('and the event fires again', function () {
        var data;
        beforeEach(function () {
          spyOne.calls.reset();
          spyTwo.calls.reset();
          event.fire(data = {});
        });
        it('should not notify either observer', function () {
          expect(spyOne).not.toHaveBeenCalledWith(context, data);
          expect(spyTwo).not.toHaveBeenCalledWith(context, data);
        });
      });
    });
  });
});

},{"./../../../lang/Disposable":23,"./../../../messaging/Event":45}],116:[function(require,module,exports){
var Disposable = require('./../../../lang/Disposable');

var Model = require('./../../../models/Model');

describe('When an Model is constructed with "firstName" and "lastName" properties', function () {
  'use strict';

  var model;
  beforeEach(function () {
    model = new Model(['firstName', 'lastName']);
  });
  describe('and a transaction observer is registered', function () {
    var spy;
    var binding;
    beforeEach(function () {
      binding = model.onTransactionCommitted(spy = jasmine.createSpy('spy'));
    });
    it('should return a Disposable instance', function () {
      expect(binding instanceof Disposable).toEqual(true);
    });
    it('should return null values for each property', function () {
      expect(model.firstName).toBe(null);
      expect(model.lastName).toBe(null);
    });
    describe('and both properties are updated', function () {
      var data;
      beforeEach(function () {
        model.firstName = 'Bryan';
        model.lastName = 'Ingle';
      });
      it('two transactions should occur', function () {
        expect(spy.calls.count()).toEqual(2);
      });
      it('the first transaction should have updated the "first name" property', function () {
        var argsOne = spy.calls.argsFor(0);
        expect(argsOne[0].firstName).toEqual('Bryan');
        expect(argsOne[0].sequence).toEqual(0);
        expect(argsOne[1]).toBe(model);
      });
      it('the second transaction should have updated the "last name" property', function () {
        var argsOne = spy.calls.argsFor(1);
        expect(argsOne[0].lastName).toEqual('Ingle');
        expect(argsOne[0].sequence).toEqual(1);
        expect(argsOne[1]).toBe(model);
      });
    });
    describe('and both properties are updated with an explicit transaction', function () {
      var data;
      beforeEach(function () {
        model.executeTransaction(function (m) {
          m.firstName = 'Bryan';
          m.lastName = 'Ingle';
        });
      });
      it('one transaction should occur', function () {
        expect(spy.calls.count()).toEqual(1);
      });
      it('the first transaction should have updated the "first name" property', function () {
        var argsOne = spy.calls.argsFor(0);
        expect(argsOne[0].firstName).toEqual('Bryan');
        expect(argsOne[0].lastName).toEqual('Ingle');
        expect(argsOne[0].sequence).toEqual(0);
        expect(argsOne[1]).toBe(model);
      });
    });
    describe('and both properties are to undefined values', function () {
      var data;
      beforeEach(function () {
        model.firstName = undefined;
        model.lastName = undefined;
      });
      it('no transactions should occur', function () {
        expect(spy.calls.count()).toEqual(0);
      });
      it('the properties should return null values', function () {
        expect(model.firstName).toBe(null);
        expect(model.lastName).toBe(null);
      });
      describe('and both are updated to non-null values', function () {
        beforeEach(function () {
          model.firstName = 0;
          model.lastName = '';
        });
        it('two transactions should occur', function () {
          expect(spy.calls.count()).toEqual(2);
        });
        it('the first transaction should have updated the "first name" property to zero', function () {
          var argsOne = spy.calls.argsFor(0);
          expect(argsOne[0].firstName).toBe(0);
          expect(argsOne[0].sequence).toEqual(0);
          expect(argsOne[1]).toBe(model);
        });
        it('the second transaction should have updated the "last name" property to a zero-length string', function () {
          var argsOne = spy.calls.argsFor(1);
          expect(argsOne[0].lastName).toBe('');
          expect(argsOne[0].sequence).toEqual(1);
          expect(argsOne[1]).toBe(model);
        });
      });
    });
  });
});

},{"./../../../lang/Disposable":23,"./../../../models/Model":47}],117:[function(require,module,exports){
var RestParser = require('./../../../../network/rest/RestParser');

describe('Using a customized JSON REST parser is created', function () {
  'use strict';

  var parser;
  var spy;
  beforeEach(function () {
    function parserFactory() {
      return spy = jasmine.createSpy('spy').and.callFake(function (k, v) {
        return k === 'fizz' ? 3 : v;
      });
    }

    parser = RestParser.getJsonParser(parserFactory);
  });
  describe('and JSON string is parsed (that represents a simple object)', function () {
    var serialzied;
    var deserialzied;
    beforeEach(function () {
      deserialzied = parser.parse(serialzied = '{"fizz":"three","bang":5}');
    });
    it('the "reviver" function should have been called', function () {
      expect(spy).toHaveBeenCalled();
    });
    it('the resulting object should have a "fizz" property with value of 3 (an override)', function () {
      expect(deserialzied.fizz).toEqual(3);
    });
    it('the resulting object should have a "bang" property with a value of 5', function () {
      expect(deserialzied.bang).toEqual(5);
    });
  });
});
describe('Using another customized JSON REST parser is created', function () {
  'use strict';

  var parser;
  var spy;
  beforeEach(function () {
    function parserFactory() {
      return spy = jasmine.createSpy('spy').and.callFake(function (k, v) {
        return k === 'fizz' ? 3 : v;
      });
    }

    parser = RestParser.getJsonParser(parserFactory);
  });
  describe('and JSON string is parsed (that represents an array of simple objects)', function () {
    var serialzied;
    var deserialzied;
    beforeEach(function () {
      deserialzied = parser.parse(serialzied = '[{"fizz":"three","bang":5},{"fizz":"four","bang":6}]');
    });
    it('the "reviver" function should have been called', function () {
      expect(spy).toHaveBeenCalled();
    });
    it('the resulting object should be an array', function () {
      expect(Array.isArray(deserialzied)).toEqual(true);
    });
    it('the first object should have a "fizz" property with value of 3 (an override)', function () {
      expect(deserialzied[0].fizz).toEqual(3);
    });
    it('the first object should have a "bang" property with a value of 5', function () {
      expect(deserialzied[0].bang).toEqual(5);
    });
    it('the second object should have a "fizz" property with value of 3 (an override)', function () {
      expect(deserialzied[1].fizz).toEqual(3);
    });
    it('the second object should have a "bang" property with a value of 6', function () {
      expect(deserialzied[1].bang).toEqual(6);
    });
  });
});

},{"./../../../../network/rest/RestParser":48}],118:[function(require,module,exports){
var AdHoc = require('./../../../../lang/AdHoc'),
    Currency = require('./../../../../lang/Currency'),
    Day = require('./../../../../lang/Day'),
    Decimal = require('./../../../../lang/Decimal'),
    Enum = require('./../../../../lang/Enum'),
    Money = require('./../../../../lang/Money');

var DataType = require('./../../../../serialization/json/DataType'),
    Component = require('./../../../../serialization/json/Component'),
    Field = require('./../../../../serialization/json/Field'),
    Schema = require('./../../../../serialization/json/Schema');

class Letter extends Enum {
  constructor(name) {
    super(name, name);
  }

}

var LETTER_A = new Letter('A');
var LETTER_B = new Letter('B');
describe('When a person schema is created (first and last names)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('person', [new Field('first', DataType.STRING), new Field('last', DataType.STRING)]);
  });
  describe('and a schema-compliant object is created', function () {
    var object;
    beforeEach(function () {
      object = {
        first: 'bryan',
        last: 'ingle'
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          deserialized = JSON.parse(serialized, schema.getReviver());
        });
        it('should have a "first" property with the expected value', function () {
          expect(deserialized.first).toEqual('bryan');
        });
        it('should have a "last" property with the expected value', function () {
          expect(deserialized.last).toEqual('ingle');
        });
      });
    });
    describe('and the object is validated', function () {
      it('the object should be valid', function () {
        expect(schema.validate(object)).toEqual(true);
      });
      it('no invalid fields should be reported by the schema', function () {
        expect(schema.getInvalidFields(object).length).toEqual(0);
      });
    });
    describe('and various invalid objects are validated', function () {
      it('a null object should be invalid', function () {
        expect(schema.validate(null)).toEqual(false);
      });
      it('a undefined object should be invalid', function () {
        expect(schema.validate()).toEqual(false);
      });
      it('an empty object should be invalid', function () {
        expect(schema.validate({})).toEqual(false);
      });
      it('an object with only a first name should be invalid', function () {
        expect(schema.validate({
          first: 'bryan'
        })).toEqual(false);
      });
      it('an object with only a last name should be invalid', function () {
        expect(schema.validate({
          last: 'ingle'
        })).toEqual(false);
      });
      it('an object with with invalid first and last names should be invalid', function () {
        expect(schema.validate({
          first: 1,
          last: {}
        })).toEqual(false);
      });
    });
    describe('and various are checked for invalid fields', function () {
      it('a null object should have two invalid fields', function () {
        expect(schema.getInvalidFields(null).length).toEqual(2);
      });
      it('a undefined object should have two invalid fields', function () {
        expect(schema.getInvalidFields().length).toEqual(2);
      });
      it('an empty object should have two invalid fields', function () {
        expect(schema.getInvalidFields({}).length).toEqual(2);
      });
      it('an object with only a first name should have one invalid fields', function () {
        expect(schema.getInvalidFields({
          first: 'bryan'
        }).length).toEqual(1);
      });
      it('an object with only a last name should have one invalid fields', function () {
        expect(schema.getInvalidFields({
          last: 'ingle'
        }).length).toEqual(1);
      });
      it('an object with with invalid first and last names should have two invalid fields', function () {
        expect(schema.getInvalidFields({
          first: 1,
          last: {}
        }).length).toEqual(2);
      });
    });
  });
  describe('and a schema-compliant array is created', function () {
    var object;
    beforeEach(function () {
      object = [{
        first: 'bryan',
        last: 'ingle'
      }, {
        first: 'borja',
        last: 'yanes'
      }];
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          try {
            deserialized = JSON.parse(serialized, schema.getReviver());
          } catch (e) {
            console.log(e);
          }
        });
        it('should be an array with two items', function () {
          expect(deserialized.length).toEqual(2);
        });
        it('the first item should have a "first" property with the expected value', function () {
          expect(deserialized[0].first).toEqual('bryan');
        });
        it('the first item should have a "last" property with the expected value', function () {
          expect(deserialized[0].last).toEqual('ingle');
        });
        it('the second item should have a "first" property with the expected value', function () {
          expect(deserialized[1].first).toEqual('borja');
        });
        it('the second item should have a "last" property with the expected value', function () {
          expect(deserialized[1].last).toEqual('yanes');
        });
      });
    });
  });
});
describe('When a person schema is created (first and last names, with optional middle name)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('person', [new Field('first', DataType.STRING), new Field('middle', DataType.STRING, true), new Field('last', DataType.STRING)]);
  });
  describe('and a schema-compliant object is created (with middle name)', function () {
    var object;
    beforeEach(function () {
      object = {
        first: 'bryan',
        middle: 'ray',
        last: 'ingle'
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          deserialized = JSON.parse(serialized, schema.getReviver());
        });
        it('should have a "first" property with the expected value', function () {
          expect(deserialized.first).toEqual('bryan');
        });
        it('should have a "middle" property with the expected value', function () {
          expect(deserialized.middle).toEqual('ray');
        });
        it('should have a "last" property with the expected value', function () {
          expect(deserialized.last).toEqual('ingle');
        });
      });
    });
    describe('and the object is validated', function () {
      it('the object should be valid', function () {
        expect(schema.validate(object)).toEqual(true);
      });
      it('no invalid fields should be reported by the schema', function () {
        expect(schema.getInvalidFields(object).length).toEqual(0);
      });
    });
    describe('and various invalid objects are validated', function () {
      it('a null object should be invalid', function () {
        expect(schema.validate(null)).toEqual(false);
      });
      it('a undefined object should be invalid', function () {
        expect(schema.validate()).toEqual(false);
      });
      it('an empty object should be invalid', function () {
        expect(schema.validate({})).toEqual(false);
      });
      it('an object with only a first name should be invalid', function () {
        expect(schema.validate({
          first: 'bryan'
        })).toEqual(false);
      });
      it('an object with only a last name should be invalid', function () {
        expect(schema.validate({
          last: 'ingle'
        })).toEqual(false);
      });
      it('an object with with invalid first and last names should be invalid', function () {
        expect(schema.validate({
          first: 1,
          last: {}
        })).toEqual(false);
      });
      it('an object with with invalid middle should be invalid', function () {
        expect(schema.validate({
          first: 'bryan',
          middle: null,
          last: 'ingle'
        })).toEqual(false);
      });
    });
    describe('and various are checked for invalid fields', function () {
      it('a null object should have two invalid fields', function () {
        expect(schema.getInvalidFields(null).length).toEqual(2);
      });
      it('a undefined object should have two invalid fields', function () {
        expect(schema.getInvalidFields().length).toEqual(2);
      });
      it('an empty object should have two invalid fields', function () {
        expect(schema.getInvalidFields({}).length).toEqual(2);
      });
      it('an object with only a first name should have one invalid fields', function () {
        expect(schema.getInvalidFields({
          first: 'bryan'
        }).length).toEqual(1);
      });
      it('an object with only a last name should have one invalid fields', function () {
        expect(schema.getInvalidFields({
          last: 'ingle'
        }).length).toEqual(1);
      });
      it('an object with with invalid first and last names should have two invalid fields', function () {
        expect(schema.getInvalidFields({
          first: 1,
          last: {}
        }).length).toEqual(2);
      });
    });
  });
  describe('and a schema-compliant object is created (without middle name)', function () {
    var object;
    beforeEach(function () {
      object = {
        first: 'bryan',
        last: 'ingle'
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          deserialized = JSON.parse(serialized, schema.getReviver());
        });
        it('should have a "first" property with the expected value', function () {
          expect(deserialized.first).toEqual('bryan');
        });
        it('should not have a "middle" property', function () {
          expect(deserialized.hasOwnProperty('middle')).toEqual(false);
        });
        it('should have a "last" property with the expected value', function () {
          expect(deserialized.last).toEqual('ingle');
        });
      });
    });
    describe('and the object is validated', function () {
      it('the object should be valid', function () {
        expect(schema.validate(object)).toEqual(true);
      });
      it('no invalid fields should be reported by the schema', function () {
        expect(schema.getInvalidFields(object).length).toEqual(0);
      });
    });
  });
});
describe('When a person schema is created (grouped first and last names with a birthday)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('person', [new Field('name.first', DataType.STRING), new Field('name.last', DataType.STRING), new Field('birthday', DataType.DAY)]);
  });
  describe('and a schema-compliant object is created', function () {
    var object;
    beforeEach(function () {
      object = {
        name: {
          first: 'bryan',
          last: 'ingle'
        },
        birthday: new Day(1974, 10, 20)
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          try {
            deserialized = JSON.parse(serialized, schema.getReviver());
          } catch (e) {
            console.log(e);
          }
        });
        it('should have a "name.first" property with the expected value', function () {
          expect(deserialized.name.first).toEqual('bryan');
        });
        it('should have a "name.last" property with the expected value', function () {
          expect(deserialized.name.last).toEqual('ingle');
        });
        it('should have a "birthday" property with the expected value', function () {
          expect(deserialized.birthday.year).toEqual(1974);
          expect(deserialized.birthday.month).toEqual(10);
          expect(deserialized.birthday.day).toEqual(20);
        });
      });
    });
  });
});
describe('When an account schema is created (using the AdHoc field)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('account', [new Field('number', DataType.NUMBER), new Field('junk', DataType.AD_HOC)]);
  });
  describe('and a schema-compliant object is created', function () {
    var object;
    beforeEach(function () {
      object = {
        number: 123456789,
        junk: new AdHoc({
          address: '209 W. Jackson',
          city: 'Chicago',
          zip: '60603'
        })
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          try {
            deserialized = JSON.parse(serialized, schema.getReviver());
          } catch (e) {
            console.log(e);
          }
        });
        it('should have a "number" property with the expected value', function () {
          expect(deserialized.number).toEqual(123456789);
        });
        it('should have a "junk" property with the expected value', function () {
          expect(deserialized.junk.data.address).toEqual('209 W. Jackson');
          expect(deserialized.junk.data.city).toEqual('Chicago');
          expect(deserialized.junk.data.zip).toEqual('60603');
        });
      });
    });
  });
});
describe('When an account schema is created (using the Money component)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('account', [new Field('number', DataType.NUMBER)], [Component.forMoney('balance')]);
  });
  describe('and a schema-compliant object is created', function () {
    var object;
    beforeEach(function () {
      object = {
        number: 123456789,
        balance: new Money(314.15, Currency.USD)
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          try {
            deserialized = JSON.parse(serialized, schema.getReviver());
          } catch (e) {
            console.log(e);
          }
        });
        it('should have a "number" property with the expected value', function () {
          expect(deserialized.number).toEqual(123456789);
        });
        it('should have a "balance" property with the expected value', function () {
          expect(deserialized.balance.currency).toEqual(Currency.USD);
          expect(deserialized.balance.decimal.getIsEqual(314.15)).toEqual(true);
        });
      });
    });
  });
});
describe('When an account schema is created (using the Money component with nesting)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('account', [new Field('number', DataType.NUMBER)], [Component.forMoney('balances.yesterday'), Component.forMoney('balances.today')]);
  });
  describe('and a schema-compliant object is created', function () {
    var object;
    beforeEach(function () {
      object = {
        number: 987654321,
        balances: {
          yesterday: new Money(314.15, Currency.USD),
          today: new Money(271.83, Currency.USD)
        }
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          try {
            deserialized = JSON.parse(serialized, schema.getReviver());
          } catch (e) {
            console.log(e);
          }
        });
        it('should have a "number" property with the expected value', function () {
          expect(deserialized.number).toEqual(987654321);
        });
        it('should have a "balances.yesterday" property with the expected value', function () {
          expect(deserialized.balances.yesterday.currency).toEqual(Currency.USD);
          expect(deserialized.balances.yesterday.decimal.getIsEqual(314.15)).toEqual(true);
        });
        it('should have a "balances.today" property with the expected value', function () {
          expect(deserialized.balances.today.currency).toEqual(Currency.USD);
          expect(deserialized.balances.today.decimal.getIsEqual(271.83)).toEqual(true);
        });
      });
    });
  });
  describe('and a schema-compliant array is created', function () {
    var object;
    beforeEach(function () {
      object = [{
        number: 987654321,
        balances: {
          yesterday: new Money(314.15, Currency.USD),
          today: new Money(271.83, Currency.USD)
        }
      }, {
        number: 123456789,
        balances: {
          yesterday: new Money(141.42, Currency.USD),
          today: new Money(173.20, Currency.USD)
        }
      }];
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          try {
            deserialized = JSON.parse(serialized, schema.getReviver());
          } catch (e) {
            console.log(e);
          }
        });
        it('should be an array with two items', function () {
          expect(deserialized.length).toEqual(2);
        });
        it('the first item should have a "number" property with the expected value', function () {
          expect(deserialized[0].number).toEqual(987654321);
        });
        it('the first item should have a "balances.yesterday" property with the expected value', function () {
          expect(deserialized[0].balances.yesterday.currency).toEqual(Currency.USD);
          expect(deserialized[0].balances.yesterday.decimal.getIsEqual(314.15)).toEqual(true);
        });
        it('the first item should have a "balances.today" property with the expected value', function () {
          expect(deserialized[0].balances.today.currency).toEqual(Currency.USD);
          expect(deserialized[0].balances.today.decimal.getIsEqual(271.83)).toEqual(true);
        });
        it('the second item should have a "number" property with the expected value', function () {
          expect(deserialized[1].number).toEqual(123456789);
        });
        it('the second item should have a "balances.yesterday" property with the expected value', function () {
          expect(deserialized[1].balances.yesterday.currency).toEqual(Currency.USD);
          expect(deserialized[1].balances.yesterday.decimal.getIsEqual(141.42)).toEqual(true);
        });
        it('the second item should have a "balances.today" property with the expected value', function () {
          expect(deserialized[1].balances.today.currency).toEqual(Currency.USD);
          expect(deserialized[1].balances.today.decimal.getIsEqual(173.20)).toEqual(true);
        });
      });
    });
  });
});
describe('When a schema is created (having a nested group of optional fields)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('thing', [new Field('required.a', DataType.NUMBER), new Field('optional.b', DataType.NUMBER, true), new Field('optional.c', DataType.NUMBER, true), new Field('name', DataType.STRING)]);
  });
  describe('and a schema-compliant object is created (using one optional field)', function () {
    var object;
    beforeEach(function () {
      object = {
        required: {
          a: 1
        },
        optional: {
          b: 2
        },
        name: 'swamp'
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          deserialized = JSON.parse(serialized, schema.getReviver());
        });
        it('should have a "required" property', function () {
          expect(deserialized.hasOwnProperty('required')).toEqual(true);
        });
        it('should have a "required.a" property, with the expected value', function () {
          expect(deserialized.required.a).toEqual(1);
        });
        it('should have an "optional" property', function () {
          expect(deserialized.hasOwnProperty('optional')).toEqual(true);
        });
        it('should have a "optional.b" property, with the expected value', function () {
          expect(deserialized.optional.b).toEqual(2);
        });
        it('should not have a "optional.c" property', function () {
          expect(deserialized.optional.hasOwnProperty('c')).toEqual(false);
        });
        it('should have a "name" property, with the expected value', function () {
          expect(deserialized.name).toEqual('swamp');
        });
      });
    });
  });
  describe('and a schema-compliant object is created (using no optional fields)', function () {
    var object;
    beforeEach(function () {
      object = {
        required: {
          a: 1
        },
        name: 'swamp'
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          deserialized = JSON.parse(serialized, schema.getReviver());
        });
        it('should have a "required" property', function () {
          expect(deserialized.hasOwnProperty('required')).toEqual(true);
        });
        it('should have a "required.a" property, with the expected value', function () {
          expect(deserialized.required.a).toEqual(1);
        });
        it('should not have an "optional" property', function () {
          expect(deserialized.hasOwnProperty('optional')).toEqual(false);
        });
        it('should have a "name" property, with the expected value', function () {
          expect(deserialized.name).toEqual('swamp');
        });
      });
    });
  });
});
describe('When a complex schema is created (using custom data types)', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('complex', [new Field('number', DataType.NUMBER), new Field('string', DataType.STRING), new Field('letter', DataType.forEnum(Letter, 'Letter')), new Field('day', DataType.DAY), new Field('decimal', DataType.DECIMAL), new Field('miscellany', DataType.AD_HOC)]);
  });
  describe('and data is basic data is formatted', function () {
    var original;
    var conversion;
    beforeEach(function () {
      conversion = schema.format(original = {
        number: 1,
        string: 'two',
        letter: 'A',
        day: '2018-06-09',
        decimal: 12.34,
        miscellany: {
          stuff: 'is good'
        }
      });
    });
    it('the conversion to be a new object', function () {
      expect(conversion).not.toBe(original);
    });
    it('the conversion should have copied the number value', function () {
      expect(conversion.number).toEqual(original.number);
    });
    it('the conversion should have copied the string value', function () {
      expect(conversion.string).toEqual(original.string);
    });
    it('the conversion should have converted the letter value into an enumeration', function () {
      expect(conversion.letter).toBe(LETTER_A);
    });
    it('the conversion should have converted the day value into an Day instance', function () {
      expect(conversion.day instanceof Day).toEqual(true);
      expect(conversion.day.format()).toEqual(original.day);
    });
    it('the conversion should have converted the decimal value into an Decimal instance', function () {
      expect(conversion.decimal instanceof Decimal).toEqual(true);
      expect(conversion.decimal.getIsEqual(original.decimal)).toEqual(true);
    });
    it('the conversion should have converted the miscellany value into an AdHoc instance', function () {
      expect(conversion.miscellany instanceof AdHoc).toEqual(true);
      expect(conversion.miscellany.data.stuff).toEqual(original.miscellany.stuff);
    });
    describe('and the converted object is serialized', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(conversion);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          deserialized = JSON.parse(serialized, schema.getReviver());
        });
        it('the number field should be match the conversion', function () {
          expect(deserialized.number).toEqual(conversion.number);
        });
        it('the string field should be match the conversion', function () {
          expect(deserialized.string).toEqual(conversion.string);
        });
        it('the letter field should be match the conversion', function () {
          expect(deserialized.letter).toBe(conversion.letter);
        });
        it('the day field should be match the conversion', function () {
          expect(deserialized.day.format()).toEqual(conversion.day.format());
        });
        it('the decimal field should be match the conversion', function () {
          expect(deserialized.decimal.getIsEqual(conversion.decimal)).toEqual(true);
        });
        it('the miscellany field should be match the conversion', function () {
          expect(deserialized.miscellany.data.stuff).toEqual(conversion.miscellany.data.stuff);
        });
      });
    });
  });
});
describe('When a schema is created with only two days', function () {
  'use strict';

  var schema;
  beforeEach(function () {
    schema = new Schema('days', [new Field('first', DataType.DAY), new Field('last', DataType.DAY)]);
  });
  describe('and a schema-compliant object is created', function () {
    var object;
    beforeEach(function () {
      object = {
        first: Day.getToday(),
        last: Day.getToday()
      };
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          deserialized = JSON.parse(serialized, schema.getReviver());
        });
        it('should have a "first" property with the expected value', function () {
          expect(deserialized.first.getIsEqual(object.first)).toEqual(true);
        });
        it('should have a "last" property with the expected value', function () {
          expect(deserialized.last.getIsEqual(object.last)).toEqual(true);
        });
      });
    });
  });
  describe('and a schema-compliant array is created', function () {
    var object;
    beforeEach(function () {
      object = [{
        first: Day.getToday(),
        last: Day.getToday()
      }, {
        first: Day.getToday(),
        last: Day.getToday()
      }];
    });
    describe('and the object is "stringified" as JSON', function () {
      var serialized;
      beforeEach(function () {
        serialized = JSON.stringify(object);
      });
      describe('and the object is rehydrated using the schema reviver', function () {
        var deserialized;
        beforeEach(function () {
          try {
            deserialized = JSON.parse(serialized, schema.getReviver());
          } catch (e) {
            console.log(e);
          }
        });
        it('should be an array with two items', function () {
          expect(deserialized.length).toEqual(2);
        });
      });
    });
  });
});

},{"./../../../../lang/AdHoc":19,"./../../../../lang/Currency":20,"./../../../../lang/Day":21,"./../../../../lang/Decimal":22,"./../../../../lang/Enum":24,"./../../../../lang/Money":25,"./../../../../serialization/json/Component":55,"./../../../../serialization/json/DataType":56,"./../../../../serialization/json/Field":57,"./../../../../serialization/json/Schema":58}],119:[function(require,module,exports){
var Component = require('./../../../../../serialization/json/Component');

var DataType = require('./../../../../../serialization/json/DataType');

var SchemaBuilder = require('./../../../../../serialization/json/builders/SchemaBuilder');

describe('When using the schema builder to create a "Person" schema', function () {
  'use strict';

  var schemaBuilder;
  beforeEach(function () {
    schemaBuilder = SchemaBuilder.withName('person');
  });
  describe('that has a string-typed "name" field and a number-typed "age" field', function () {
    beforeEach(function () {
      schemaBuilder = schemaBuilder.withField('name', DataType.STRING).withField('age', DataType.NUMBER);
    });
    describe('and the schema is pulled', function () {
      var schema;
      beforeEach(function () {
        schema = schemaBuilder.schema;
      });
      it('the name should be "person"', function () {
        expect(schema.name).toEqual('person');
      });
      it('there should be two fields', function () {
        expect(schema.fields.length).toEqual(2);
      });
      it('the first field should be string-typed and called "name"', function () {
        expect(schema.fields[0].name).toEqual('name');
        expect(schema.fields[0].dataType).toEqual(DataType.STRING);
      });
      it('the second field should be number-typed and called "age"', function () {
        expect(schema.fields[1].name).toEqual('age');
        expect(schema.fields[1].dataType).toEqual(DataType.NUMBER);
      });
      it('there should be no components', function () {
        expect(schema.components.length).toEqual(0);
      });
    });
    describe('and a "wallet" component is added to the schema', function () {
      beforeEach(function () {
        schemaBuilder = schemaBuilder.withComponent(Component.forMoney('wallet'));
      });
      describe('and the schema is pulled', function () {
        var schema;
        beforeEach(function () {
          schema = schemaBuilder.schema;
        });
        it('the name should be "person"', function () {
          expect(schema.name).toEqual('person');
        });
        it('there should be two fields', function () {
          expect(schema.fields.length).toEqual(2);
        });
        it('the first field should be string-typed and called "name"', function () {
          expect(schema.fields[0].name).toEqual('name');
          expect(schema.fields[0].dataType).toEqual(DataType.STRING);
        });
        it('the second field should be number-typed and called "age"', function () {
          expect(schema.fields[1].name).toEqual('age');
          expect(schema.fields[1].dataType).toEqual(DataType.NUMBER);
        });
        it('there should be one component', function () {
          expect(schema.components.length).toEqual(1);
        });
        it('the component should be named "wallet"', function () {
          expect(schema.components[0].name).toEqual('wallet');
        });
      });
    });
    describe('and a "custom" component is added to the schema (using a component builder)', function () {
      var reviver;
      beforeEach(function () {
        schemaBuilder = schemaBuilder.withComponentBuilder('custom', function (cb) {
          cb.withField('b', DataType.STRING).withField('a', DataType.NUMBER).withReviver(reviver = function (x) {
            return 'hola amigo';
          });
        });
      });
      describe('and the schema is pulled', function () {
        var schema;
        beforeEach(function () {
          schema = schemaBuilder.schema;
        });
        it('the name should be "person"', function () {
          expect(schema.name).toEqual('person');
        });
        it('there should be two fields', function () {
          expect(schema.fields.length).toEqual(2);
        });
        it('the first field should be string-typed and called "name"', function () {
          expect(schema.fields[0].name).toEqual('name');
          expect(schema.fields[0].dataType).toEqual(DataType.STRING);
        });
        it('the second field should be number-typed and called "age"', function () {
          expect(schema.fields[1].name).toEqual('age');
          expect(schema.fields[1].dataType).toEqual(DataType.NUMBER);
        });
        it('there should be one component', function () {
          expect(schema.components.length).toEqual(1);
        });
        it('the component should be named "custom"', function () {
          expect(schema.components[0].name).toEqual('custom');
        });
        it('there component should have two fields', function () {
          expect(schema.components[0].fields.length).toEqual(2);
        });
        it('the component\'s first field should be string-typed and called "b"', function () {
          expect(schema.components[0].fields[0].name).toEqual('b');
          expect(schema.components[0].fields[0].dataType).toEqual(DataType.STRING);
        });
        it('the component\'s second field should be number-typed and called "a"', function () {
          expect(schema.components[0].fields[1].name).toEqual('a');
          expect(schema.components[0].fields[1].dataType).toEqual(DataType.NUMBER);
        });
        it('there component reviver function should be correct', function () {
          expect(schema.components[0].reviver).toBe(reviver);
        });
      });
    });
  });
});

},{"./../../../../../serialization/json/Component":55,"./../../../../../serialization/json/DataType":56,"./../../../../../serialization/json/builders/SchemaBuilder":60}],120:[function(require,module,exports){
var Specification = require('./../../../specifications/Specification');

var And = require('./../../../specifications/And');

describe('When an And is constructed', function () {
  'use strict';

  class SpecPass extends Specification {
    constructor() {
      super();
      this._spy = jasmine.createSpy('spyPass').and.returnValue(true);
    }

    _evaluate(data) {
      return this._spy(data);
    }

  }

  class SpecFail extends Specification {
    constructor() {
      super();
      this._spy = jasmine.createSpy('spyPass').and.returnValue(false);
    }

    _evaluate(data) {
      return this._spy(data);
    }

  }

  describe('with two specifications that will pass', function () {
    var specification;
    var specPassOne;
    var specPassTwo;
    var data;
    var result;
    beforeEach(function () {
      specification = new And(specPassOne = new SpecPass(), specPassTwo = new SpecPass());
      result = specification.evaluate(data = {});
    });
    it('should call the first specification', function () {
      expect(specPassOne._spy).toHaveBeenCalledWith(data);
    });
    it('should call the second specification', function () {
      expect(specPassTwo._spy).toHaveBeenCalledWith(data);
    });
    it('should evaluate to true', function () {
      expect(result).toEqual(true);
    });
  });
  describe('where the first specifications will fail', function () {
    var specification;
    var specPassOne;
    var specPassTwo;
    var data;
    var result;
    beforeEach(function () {
      specification = new And(specPassOne = new SpecFail(), specPassTwo = new SpecPass());
      result = specification.evaluate(data = {});
    });
    it('should call the first specification', function () {
      expect(specPassOne._spy).toHaveBeenCalledWith(data);
    });
    it('should not call the second specification', function () {
      expect(specPassTwo._spy).not.toHaveBeenCalledWith(data);
    });
    it('should evaluate to false', function () {
      expect(result).toEqual(false);
    });
  });
});

},{"./../../../specifications/And":61,"./../../../specifications/Specification":72}],121:[function(require,module,exports){
const Between = require('./../../../specifications/Between');

describe('When a GreaterThan is constructed (with a range of 17 to 42)', () => {
  'use strict';

  let specification;
  beforeEach(() => {
    specification = new Between([17, 42]);
  });
  it('should pass not pass when 16 is evaluated', () => {
    expect(specification.evaluate(16)).toBe(false);
  });
  it('should pass not pass when 17 is evaluated', () => {
    expect(specification.evaluate(17)).toBe(false);
  });
  it('should pass pass when 18 is evaluated', () => {
    expect(specification.evaluate(18)).toBe(true);
  });
  it('should pass pass when 41 is evaluated', () => {
    expect(specification.evaluate(41)).toBe(true);
  });
  it('should pass not pass when 42 is evaluated', () => {
    expect(specification.evaluate(42)).toBe(false);
  });
  it('should pass not pass when 43 is evaluated', () => {
    expect(specification.evaluate(43)).toBe(false);
  });
});

},{"./../../../specifications/Between":62}],122:[function(require,module,exports){
var Contained = require('./../../../specifications/Contained');

describe('When a Contained is constructed', function () {
  'use strict';

  var specification;
  var specificationValue;
  beforeEach(function () {
    specification = new Contained(specificationValue = ['xyz', 123]);
  });
  describe('and a string, contained in the array, is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate('xyz');
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
  describe('and a string, not contained in the array, is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate('abc');
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and a number, contained in the array, is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(123);
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
  describe('and a number, not contained in the array, is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(1);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
});

},{"./../../../specifications/Contained":63}],123:[function(require,module,exports){
var Contains = require('./../../../specifications/Contains');

describe('When a Contains is constructed', function () {
  'use strict';

  var specification;
  var specificationValue;
  beforeEach(function () {
    specification = new Contains(specificationValue = 'xyz');
  });
  describe('and an array, containing the desired value, is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(['abc', 'def', specificationValue, 1, 2, 3]);
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
  describe('and an array, missing the desired value, is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(['abc', 'def', 1, 2, 3]);
    });
    it('should fail', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and an object is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate({
        abc: 'xyz',
        xyz: 'abc'
      });
    });
    it('should fail', function () {
      expect(result).toEqual(false);
    });
  });
});

},{"./../../../specifications/Contains":64}],124:[function(require,module,exports){
const Equals = require('./../../../specifications/Equals');

describe('When a Equals is constructed', () => {
  'use strict';

  let specification;
  let value;
  beforeEach(() => {
    specification = new Equals(value = {});
  });
  describe('and the same object is evaluated', () => {
    let result;
    beforeEach(() => {
      result = specification.evaluate(value);
    });
    it('should pass', () => {
      expect(result).toEqual(true);
    });
  });
  describe('and a different same object is evaluated', () => {
    let result;
    beforeEach(() => {
      result = specification.evaluate({});
    });
    it('should not pass', () => {
      expect(result).toEqual(false);
    });
  });
});

},{"./../../../specifications/Equals":65}],125:[function(require,module,exports){
var Fail = require('./../../../specifications/Fail');

describe('When a Fail is constructed', function () {
  'use strict';

  var specification;
  var specificationValue;
  beforeEach(function () {
    specification = new Fail(specificationValue = 'ignored');
  });
  describe('and a string is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate('abc');
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and a null value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(null);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and an undefined value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(undefined);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
});

},{"./../../../specifications/Fail":66}],126:[function(require,module,exports){
var Nan = require('./../../../specifications/Nan');

describe('When a Nan is constructed', function () {
  'use strict';

  var specification;
  beforeEach(function () {
    specification = new Nan();
  });
  describe('and a string is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate('abc');
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and a null value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(null);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and an undefined value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(undefined);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and an integer value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(1);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and a NaN value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(parseFloat(null));
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
});

},{"./../../../specifications/Nan":67}],127:[function(require,module,exports){
var Not = require('./../../../specifications/Not');

var Specification = require('./../../../specifications/Specification');

describe('When a Not is constructed', function () {
  'use strict';

  class DelegateSpecification extends Specification {
    constructor(fn) {
      super();
      this._fn = fn;
    }

    _evaluate(data) {
      return this._fn(data);
    }

  }

  describe('with a specification that always fails', function () {
    var specification;
    var spy;
    var result;
    beforeEach(function () {
      specification = new Not(new DelegateSpecification(spy = jasmine.createSpy('fn').and.callFake(function (data) {
        return false;
      })));
      result = specification.evaluate('abc');
    });
    it('should call the wrapped specification', function () {
      expect(spy).toHaveBeenCalled();
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
  describe('with a specification that always passes', function () {
    var specification;
    var spy;
    var result;
    beforeEach(function () {
      specification = new Not(new DelegateSpecification(spy = jasmine.createSpy('fn').and.callFake(function (data) {
        return true;
      })));
      result = specification.evaluate('abc');
    });
    it('should call the wrapped specification', function () {
      expect(spy).toHaveBeenCalled();
    });
    it('should pass', function () {
      expect(result).toEqual(false);
    });
  });
});
describe('When a Specification (that always fails) is constructed', function () {
  'use strict';

  class DelegateSpecification extends Specification {
    constructor(fn) {
      super();
      this._fn = fn;
    }

    _evaluate(data) {
      return this._fn(data);
    }

  }

  describe('and inverted', function () {
    var specification;
    var spy;
    var result;
    beforeEach(function () {
      specification = new DelegateSpecification(spy = jasmine.createSpy('fn').and.callFake(function (data) {
        return false;
      }));
      specification = specification.not();
      result = specification.evaluate('abc');
    });
    it('should call the original specification', function () {
      expect(spy).toHaveBeenCalled();
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
});
describe('When a Specification (that always succeeds) is constructed', function () {
  'use strict';

  class DelegateSpecification extends Specification {
    constructor(fn) {
      super();
      this._fn = fn;
    }

    _evaluate(data) {
      return this._fn(data);
    }

  }

  describe('and inverted', function () {
    var specification;
    var spy;
    var result;
    beforeEach(function () {
      specification = new DelegateSpecification(spy = jasmine.createSpy('fn').and.callFake(function (data) {
        return true;
      }));
      specification = specification.not();
      result = specification.evaluate('abc');
    });
    it('should call the original specification', function () {
      expect(spy).toHaveBeenCalled();
    });
    it('should pass', function () {
      expect(result).toEqual(false);
    });
  });
});

},{"./../../../specifications/Not":68,"./../../../specifications/Specification":72}],128:[function(require,module,exports){
var Numeric = require('./../../../specifications/Numeric');

describe('When a Numeric is constructed', function () {
  'use strict';

  var specification;
  beforeEach(function () {
    specification = new Numeric();
  });
  describe('and a string is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate('abc');
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and a null value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(null);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and an undefined value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(undefined);
    });
    it('should not pass', function () {
      expect(result).toEqual(false);
    });
  });
  describe('and a number value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(0);
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
});

},{"./../../../specifications/Numeric":69}],129:[function(require,module,exports){
var Specification = require('./../../../specifications/Specification');

var Or = require('./../../../specifications/Or');

describe('When an Or is constructed', function () {
  'use strict';

  class SpecPass extends Specification {
    constructor() {
      super();
      this._spy = jasmine.createSpy('spyPass').and.returnValue(true);
    }

    _evaluate(data) {
      return this._spy(data);
    }

  }

  class SpecFail extends Specification {
    constructor() {
      super();
      this._spy = jasmine.createSpy('spyPass').and.returnValue(false);
    }

    _evaluate(data) {
      return this._spy(data);
    }

  }

  describe('with two specifications that will pass', function () {
    var specification;
    var specPassOne;
    var specPassTwo;
    var data;
    var result;
    beforeEach(function () {
      specification = new Or(specPassOne = new SpecPass(), specPassTwo = new SpecPass());
      result = specification.evaluate(data = {});
    });
    it('should call the first specification', function () {
      expect(specPassOne._spy).toHaveBeenCalledWith(data);
    });
    it('should not call the second specification', function () {
      expect(specPassTwo._spy).not.toHaveBeenCalledWith(data);
    });
    it('should evaluate to false', function () {
      expect(result).toEqual(true);
    });
  });
  describe('with two specifications that will fail', function () {
    var specification;
    var specPassOne;
    var specPassTwo;
    var data;
    var result;
    beforeEach(function () {
      specification = new Or(specPassOne = new SpecFail(), specPassTwo = new SpecFail());
      result = specification.evaluate(data = {});
    });
    it('should call the first specification', function () {
      expect(specPassOne._spy).toHaveBeenCalledWith(data);
    });
    it('should call the second specification', function () {
      expect(specPassTwo._spy).toHaveBeenCalledWith(data);
    });
    it('should evaluate to false', function () {
      expect(result).toEqual(false);
    });
  });
});

},{"./../../../specifications/Or":70,"./../../../specifications/Specification":72}],130:[function(require,module,exports){
var Pass = require('./../../../specifications/Pass');

describe('When a Pass is constructed', function () {
  'use strict';

  var specification;
  var specificationValue;
  beforeEach(function () {
    specification = new Pass(specificationValue = 'ignored');
  });
  describe('and a string is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate('abc');
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
  describe('and a null value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(null);
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
  describe('and an undefined value is evaluated', function () {
    var result;
    beforeEach(function () {
      result = specification.evaluate(undefined);
    });
    it('should pass', function () {
      expect(result).toEqual(true);
    });
  });
});

},{"./../../../specifications/Pass":71}],131:[function(require,module,exports){
const GreaterThan = require('./../../../../specifications/compound/GreaterThan');

describe('When a GreaterThan is constructed', () => {
  'use strict';

  let specification;
  beforeEach(() => {
    specification = new GreaterThan();
  });
  it('should pass when the first item is larger than the second item', () => {
    expect(specification.evaluate([2, 1])).toBe(true);
  });
  it('should not pass when the first item is smaller than the second item', () => {
    expect(specification.evaluate([1, 2])).toBe(false);
  });
  it('should not pass when the first and second items are equal', () => {
    expect(specification.evaluate([1, 1])).toBe(false);
  });
});

},{"./../../../../specifications/compound/GreaterThan":73}],132:[function(require,module,exports){
const LessThan = require('./../../../../specifications/compound/LessThan');

describe('When a LessThan is constructed', () => {
  'use strict';

  let specification;
  beforeEach(() => {
    specification = new LessThan();
  });
  it('should pass when the first item is smaller than the second item', () => {
    expect(specification.evaluate([1, 2])).toBe(true);
  });
  it('should not pass when the first item is larger than the second item', () => {
    expect(specification.evaluate([2, 1])).toBe(false);
  });
  it('should not pass when the first and second items are equal', () => {
    expect(specification.evaluate([1, 1])).toBe(false);
  });
});

},{"./../../../../specifications/compound/LessThan":74}],133:[function(require,module,exports){
var RateLimiter = require('./../../../timing/RateLimiter');

describe('When a RateLimiter is constructed (1 execution per 25 milliseconds)', function () {
  'use strict';

  var limiter;
  var windowMaximumCount;
  var windowDurationMilliseconds;
  var concurrency;
  beforeEach(function () {
    limiter = new RateLimiter(windowMaximumCount = 1, windowDurationMilliseconds = 25, concurrency = null);
  });
  describe('and tasks are scheduled', function () {
    var spies;
    var promises;
    var start;
    beforeEach(function () {
      start = new Date();
      spies = [];
      promises = [];

      for (var i = 0; i < 10; i++) {
        var spy = jasmine.createSpy('spy');
        spies.push(spy);
        promises.push(limiter.enqueue(spy));
      }
    });
    it('the tasks should serialized', function (done) {
      var promise = null;

      var getValidatedPromise = function (promise, index) {
        return promise.then(function () {
          for (var i = 0; i < spies.length; i++) {
            var count;

            if (i > index) {
              count = 0;
            } else {
              count = 1;
            }

            expect(spies[i].calls.count()).toEqual(count);
          }
        });
      };

      for (var i = 0; i < promises.length; i++) {
        var p = getValidatedPromise(promises[i], i);

        if (promise === null) {
          promise = p;
        } else {
          promise = promise.then(function () {
            return p;
          });
        }
      }

      promise.then(function () {
        done();
      });
    });
    it('the tasks not finish before the earliest possible moment', function (done) {
      var promise = null;

      var getValidatedPromise = function (promise, index) {
        return promise.then(function () {
          var end = new Date();
          var duration = end.getTime() - start.getTime();
          var shortestPossibleDuration = Math.floor(index / windowMaximumCount) * windowDurationMilliseconds;
          expect(duration + 1).not.toBeLessThan(shortestPossibleDuration);
        });
      };

      for (var i = 0; i < promises.length; i++) {
        var p = getValidatedPromise(promises[i], i);

        if (promise === null) {
          promise = p;
        } else {
          promise = promise.then(function () {
            return p;
          });
        }
      }

      promise.then(function () {
        done();
      });
    });
  });
  describe('and failing tasks are scheduled', function () {
    var spies;
    var promises;
    var error;
    var start;
    beforeEach(function () {
      start = new Date();
      spies = [];
      promises = [];
      error = new Error('oops');

      for (var i = 0; i < 2; i++) {
        var spy = jasmine.createSpy('spy').and.callFake(function () {
          throw error;
        });
        spies.push(spy);
        promises.push(limiter.enqueue(spy));
      }
    });
    it('each task should be executed', function (done) {
      var promise = null;

      var getValidatedPromise = function (promise, index) {
        return promise.catch(function (error) {
          var end = new Date();
          var duration = end.getTime() - start.getTime();
          var shortestPossibleDuration = Math.floor(index / windowMaximumCount) * windowDurationMilliseconds;
          expect(duration + 1).not.toBeLessThan(shortestPossibleDuration);
          expect(error).toBe(error);
        });
      };

      for (var i = 0; i < promises.length; i++) {
        var p = getValidatedPromise(promises[i], i);

        if (promise === null) {
          promise = p;
        } else {
          promise = promise.then(function () {
            return p;
          });
        }
      }

      promise.then(function () {
        done();
      });
    });
  });
});
describe('When a RateLimiter is constructed (2 execution per 25 milliseconds)', function () {
  'use strict';

  var limiter;
  var windowMaximumCount;
  var windowDurationMilliseconds;
  var concurrency;
  beforeEach(function () {
    limiter = new RateLimiter(windowMaximumCount = 2, windowDurationMilliseconds = 25, concurrency = null);
  });
  describe('and tasks are scheduled', function () {
    var spies;
    var promises;
    var start;
    beforeEach(function () {
      start = new Date();
      spies = [];
      promises = [];

      for (var i = 0; i < 10; i++) {
        var spy = jasmine.createSpy('spy');
        spies.push(spy);
        promises.push(limiter.enqueue(spy));
      }
    });
    it('the tasks not finish before the earliest possible moment', function (done) {
      var promise = null;

      var getValidatedPromise = function (promise, index) {
        return promise.then(function () {
          var end = new Date();
          var duration = end.getTime() - start.getTime();
          var shortestPossibleDuration = Math.floor(index / windowMaximumCount) * windowDurationMilliseconds;
          expect(duration + 1).not.toBeLessThan(shortestPossibleDuration);
        });
      };

      for (var i = 0; i < promises.length; i++) {
        var p = getValidatedPromise(promises[i], i);

        if (promise === null) {
          promise = p;
        } else {
          promise = promise.then(function () {
            return p;
          });
        }
      }

      promise.then(function () {
        done();
      });
    });
  });
});

},{"./../../../timing/RateLimiter":137}],134:[function(require,module,exports){
var Scheduler = require('./../../../timing/Scheduler');

describe('When a Scheduler is constructed', function () {
  'use strict';

  var scheduler;
  beforeEach(function () {
    scheduler = new Scheduler();
  });
  describe('and task is scheduled', function () {
    var spy;
    var milliseconds;
    var promise;
    beforeEach(function () {
      promise = scheduler.schedule(spy = jasmine.createSpy('spy'), milliseconds = 10, 'A scheduled task');
    });
    it('should not execute the task synchronously', function () {
      expect(spy).not.toHaveBeenCalled();
    });
    it('should execute the task asynchronously', function (done) {
      promise.then(function () {
        expect(spy.calls.count()).toEqual(1);
      }).then(function () {
        done();
      });
    });
  });
  describe('and is disposed', function () {
    beforeEach(function () {
      scheduler.dispose();
    });
    describe('and a task is scheduled', function () {
      var spy;
      var success;
      beforeEach(function (done) {
        scheduler.schedule(spy = jasmine.createSpy('spy'), 10, 'A scheduled task').then(() => {
          success = true;
        }).catch(() => {
          success = false;
        }).then(() => {
          done();
        });
      });
      it('should reject the promise', function () {
        expect(success).toEqual(false);
      });
      it('should not invoke the underlying task', function () {
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });
});
describe('When a backoff is used', function () {
  'use strict';

  var scheduler;
  beforeEach(function () {
    scheduler = new Scheduler();
  });
  describe('that succeeds immediately', function () {
    var spyAction;
    var spyFailure;
    var actualResult;
    var successfulResult;
    beforeEach(function (done) {
      spyAction = jasmine.createSpy('spyAction').and.callFake(function () {
        return successfulResult = 'ok computer';
      });
      spyFailure = jasmine.createSpy('spyFailure');
      scheduler.backoff(spyAction, 5, 'succeeds immediately', 1, spyFailure).then(function (r) {
        actualResult = r;
        done();
      });
    });
    it('should call the "backoff" action one time', function () {
      expect(spyAction.calls.count()).toEqual(1);
    });
    it('the promise result should match the expected result', function () {
      expect(actualResult).toEqual(successfulResult);
    });
    it('should never call the "failure" action', function () {
      expect(spyFailure.calls.count()).toEqual(0);
    });
  });
  describe('that fails once before succeeding (by throwing error)', function () {
    var spyAction;
    var spyFailure;
    var actualResult;
    var successfulResult;
    var x;
    beforeEach(function (done) {
      x = 0;
      spyAction = jasmine.createSpy('spyAction').and.callFake(function () {
        if (++x > 1) {
          return successfulResult = 'ok computer';
        } else {
          throw new Error('nope...');
        }
      });
      spyFailure = jasmine.createSpy('spyFailure');
      scheduler.backoff(spyAction, 5, 'succeeds immediately', 5, spyFailure).then(function (r) {
        actualResult = r;
        done();
      });
    });
    it('should call the "backoff" action two times', function () {
      expect(spyAction.calls.count()).toEqual(2);
    });
    it('the promise result should match the expected result', function () {
      expect(actualResult).toEqual(successfulResult);
    });
    it('the "failure" action should be called once', function () {
      expect(spyFailure.calls.count()).toEqual(1);
    });
  });
  describe('that fails twice before succeeding (by returning a specific "failure" value)', function () {
    var spyAction;
    var spyFailure;
    var actualResult;
    var successfulResult;
    var x;
    beforeEach(function (done) {
      x = 0;
      spyAction = jasmine.createSpy('spyAction').and.callFake(function () {
        if (++x > 2) {
          return successfulResult = ['ok computer'];
        } else {
          return [];
        }
      });
      spyFailure = jasmine.createSpy('spyFailure');
      scheduler.backoff(spyAction, 5, 'succeeds immediately', 5, spyFailure, []).then(function (r) {
        actualResult = r;
        done();
      });
    });
    it('should call the "backoff" action three times', function () {
      expect(spyAction.calls.count()).toEqual(3);
    });
    it('the promise result should match the expected result', function () {
      expect(actualResult).toEqual(successfulResult);
    });
    it('the "failure" action should be called twice', function () {
      expect(spyFailure.calls.count()).toEqual(2);
    });
  });
  describe('final failure is declared after three attempts', function () {
    var spyAction;
    var spyFailure;
    var actualResult;
    beforeEach(function (done) {
      spyAction = jasmine.createSpy('spyAction').and.callFake(function () {
        throw new Error('not gonna happen');
      });
      spyFailure = jasmine.createSpy('spyFailure');
      scheduler.backoff(spyAction, 5, 'succeeds immediately', 3, spyFailure, []).catch(function (r) {
        actualResult = r;
        done();
      });
    });
    it('should call the "backoff" action three times', function () {
      expect(spyAction.calls.count()).toEqual(3);
    });
    it('the "failure" action should be called three times', function () {
      expect(spyFailure.calls.count()).toEqual(3);
    });
    it('the promise should be rejected (with an Error instance)', function () {
      expect(actualResult instanceof Error).toEqual(true);
    });
  });
  describe('final failure is declared after three attempts (using the "failureValue" argument)', function () {
    var spyAction;
    var spyFailure;
    var actualResult;
    beforeEach(function (done) {
      spyAction = jasmine.createSpy('spyAction').and.callFake(function () {
        return 'boom';
      });
      spyFailure = jasmine.createSpy('spyFailure');
      scheduler.backoff(spyAction, 5, 'detonate', 3, spyFailure, 'boom').catch(function (r) {
        actualResult = r;
        done();
      });
    });
    it('should call the "backoff" action three times', function () {
      expect(spyAction.calls.count()).toEqual(3);
    });
    it('the "failure" action should be called three times', function () {
      expect(spyFailure.calls.count()).toEqual(3);
    });
    it('the promise should be rejected', function () {
      expect(actualResult).toEqual('Maximum failures reached for detonate');
    });
  });
});

},{"./../../../timing/Scheduler":138}],135:[function(require,module,exports){
var Serializer = require('./../../../timing/Serializer');

describe('When a Serializer is used to schedule four tasks', function () {
  'use strict';

  var serializer;
  var spies;
  var promises;
  var results;
  beforeEach(function () {
    serializer = new Serializer();
    spies = [];
    promises = [];
    results = [];

    for (var i = 0; i < 4; i++) {
      var spy = getSpy(results, false);
      spies.push(spy);
      promises.push(serializer.enqueue(spy));
    }
  });
  describe('and the tasks complete', function () {
    beforeEach(function (done) {
      Promise.all(promises).then(() => {
        done();
      });
    });
    it('the first task should have been executed', function () {
      expect(spies[0]).toHaveBeenCalled();
    });
    it('the second task should have been executed', function () {
      expect(spies[1]).toHaveBeenCalled();
    });
    it('the third task should have been executed', function () {
      expect(spies[2]).toHaveBeenCalled();
    });
    it('the fourth task should have been executed', function () {
      expect(spies[3]).toHaveBeenCalled();
    });
    it('the first task should complete before the second task starts', function () {
      expect(results[0].end <= results[1].start).toEqual(true);
    });
    it('the second task should complete before the third task starts', function () {
      expect(results[1].end <= results[2].start).toEqual(true);
    });
    it('the third task should complete before the fourth task starts', function () {
      expect(results[2].end <= results[3].start).toEqual(true);
    });
  });
});
describe('When a Serializer is used to schedule a task that throws', function () {
  var serializer;
  var promise;
  var reject;
  beforeEach(function (done) {
    serializer = new Serializer();
    reject = false;
    promise = serializer.enqueue(function () {
      throw new Error('Boom');
    }).catch(e => {
      reject = true;
      done();
    });
  });
  it('should reject the promise', function () {
    expect(reject).toEqual(true);
  });
});
describe('When a Serializer is used to schedule a task that rejects', function () {
  var serializer;
  var promise;
  var reject;
  beforeEach(function (done) {
    serializer = new Serializer();
    reject = false;
    promise = serializer.enqueue(function () {
      return Promise.reject('Boom Boom');
    }).catch(e => {
      reject = true;
      done();
    });
  });
  it('should reject the promise', function () {
    expect(reject).toEqual(true);
  });
});

function getSpy(results, fail) {
  return jasmine.createSpy('spy').and.callFake(function () {
    return new Promise(function (resolveCallback, rejectCallback) {
      var start = new Date();
      setTimeout(function () {
        var end = new Date();
        results.push({
          start: start.getTime(),
          end: end.getTime()
        });

        if (fail) {
          rejectCallback();
        } else {
          resolveCallback();
        }
      }, 5);
    });
  });
}

},{"./../../../timing/Serializer":139}],136:[function(require,module,exports){
var WindowCounter = require('./../../../timing/WindowCounter');

describe('When a WindowCounter is constructed', function () {
  'use strict';

  var duration;
  var windows;
  var counter;
  beforeEach(function () {
    counter = new WindowCounter(duration = 15, windows = 100);
  });
  describe('and the counter is immediately incremented', function () {
    var a;
    beforeEach(function () {
      counter.increment(a = 42);
    });
    it('the current count should be the amount added', function () {
      expect(counter.getCurrent()).toEqual(a);
    });
    describe('and the counter is immediately incremented, again', function () {
      var b;
      beforeEach(function () {
        counter.increment(b = 99);
      });
      it('the current count should be the sum of the amounts added', function () {
        expect(counter.getCurrent()).toEqual(a + b);
      });
    });
    describe('and the counter is incremented after the current window expires', function () {
      var b;
      beforeEach(function (done) {
        setTimeout(function () {
          counter.increment(b = 3);
          done();
        }, duration + duration / 2);
      });
      it('the previous count should be the sum of the previous window', function () {
        expect(counter.getPrevious()).toEqual(a);
      });
      it('the current count should be the amount added', function () {
        expect(counter.getCurrent()).toEqual(b);
      });
      it('the average count should be the sum of the previous window', function () {
        expect(counter.getAverage()).toEqual(a);
      });
    });
  });
});

},{"./../../../timing/WindowCounter":140}],137:[function(require,module,exports){
const assert = require('./../lang/assert'),
      Disposable = require('./../lang/Disposable'),
      promise = require('./../lang/promise');

const Queue = require('./../collections/Queue'),
      Scheduler = require('./Scheduler');

module.exports = (() => {
  'use strict';
  /**
   * A work queue that restricts the rate at which items are
   * processed.
   *
   * @public
   * @param {number} - windowMaximumCount - The maximum number of items which can be processed during a timeframe.
   * @param {number} - windowDurationMilliseconds - The number of milliseconds in the timeframe.
   * @extends {Disposable}
   */

  class RateLimiter extends Disposable {
    constructor(windowMaximumCount, windowDurationMilliseconds) {
      super();
      assert.argumentIsRequired(windowMaximumCount, 'windowMaximumCount', Number);
      assert.argumentIsRequired(windowDurationMilliseconds, 'windowDurationMilliseconds', Number);
      this._windowMaximumCount = windowMaximumCount;
      this._windowDurationMilliseconds = windowDurationMilliseconds;
      this._scheduler = new Scheduler();
      this._workQueue = new Queue();
      this._windowStart = null;
      this._windowCounter = 0;
    }
    /**
     * Adds an item to the work queue and returns a promise that will
     * resolve after the item completes execution.
     *
     * @param {Function} actionToEnqueue - The action to execute.
     * @returns {Promise}
     */


    enqueue(actionToEnqueue) {
      return promise.build((resolveCallback, rejectCallback) => {
        assert.argumentIsRequired(actionToEnqueue, 'actionToEnqueue', Function);

        if (this.getIsDisposed()) {
          throw new Error('Unable to enqueue action, the rate limiter has been disposed.');
        }

        this._workQueue.enqueue(() => {
          Promise.resolve().then(() => {
            return actionToEnqueue();
          }).then(result => {
            resolveCallback(result);
          }).catch(error => {
            rejectCallback(error);
          }).then(() => {
            checkStart.call(this);
          });
        });

        checkStart.call(this);
      });
    }

    _onDispose() {
      this._scheduler.dispose();

      this._workQueue = null;
    }

    toString() {
      return '[RateLimiter]';
    }

  }

  function checkStart() {
    if (this.getIsDisposed()) {
      return;
    }

    if (this._workQueue.empty()) {
      return;
    }

    if (this._windowStart === null) {
      const timestamp = new Date();
      this._windowStart = timestamp.getTime();
      this._windowCounter = 0;

      const resetWindow = () => {
        this._windowStart = null;
        this._windowCounter = 0;
        checkStart.call(this);
      };

      this._scheduler.schedule(resetWindow, this._windowDurationMilliseconds, 'Rate Limiter Window Reset');
    }

    if (this._windowCounter < this._windowMaximumCount) {
      this._windowCounter = this._windowCounter + 1;

      const actionToExecute = this._workQueue.dequeue();

      actionToExecute();
    }
  }

  return RateLimiter;
})();

},{"./../collections/Queue":5,"./../lang/Disposable":23,"./../lang/assert":30,"./../lang/promise":41,"./Scheduler":138}],138:[function(require,module,exports){
const assert = require('./../lang/assert'),
      Disposable = require('./../lang/Disposable'),
      is = require('./../lang/is'),
      object = require('./../lang/object'),
      promise = require('./../lang/promise');

module.exports = (() => {
  'use strict';
  /**
   * An object that wraps asynchronous delays (i.e. timeout and interval).
   *
   * @public
   * @extends {Disposable}
   */

  class Scheduler extends Disposable {
    constructor() {
      super();
      this._timeoutBindings = {};
      this._intervalBindings = {};
    }
    /**
     * Schedules an action to execute in the future, returning a Promise.
     *
     * @public
     * @param {Function} actionToSchedule - The action to execute.
     * @param {number} millisecondDelay - Milliseconds before the action can be started.
     * @param {string=} actionDescription - A description of the action, used for logging purposes.
     * @returns {Promise}
     */


    schedule(actionToSchedule, millisecondDelay, actionDescription) {
      return Promise.resolve().then(() => {
        assert.argumentIsRequired(actionToSchedule, 'actionToSchedule', Function);
        assert.argumentIsRequired(millisecondDelay, 'millisecondDelay', Number);
        assert.argumentIsOptional(actionDescription, 'actionDescription', String);

        if (this.getIsDisposed()) {
          throw new Error('The Scheduler has been disposed.');
        }

        let token;
        const schedulePromise = promise.build((resolveCallback, rejectCallback) => {
          const wrappedAction = () => {
            delete this._timeoutBindings[token];

            try {
              resolveCallback(actionToSchedule());
            } catch (e) {
              rejectCallback(e);
            }
          };

          token = setTimeout(wrappedAction, millisecondDelay);
        });
        this._timeoutBindings[token] = Disposable.fromAction(() => {
          clearTimeout(token);
          delete this._timeoutBindings[token];
        });
        return schedulePromise;
      });
    }

    repeat(actionToRepeat, millisecondInterval, actionDescription) {
      assert.argumentIsRequired(actionToRepeat, 'actionToRepeat', Function);
      assert.argumentIsRequired(millisecondInterval, 'millisecondInterval', Number);
      assert.argumentIsOptional(actionDescription, 'actionDescription', String);

      if (this.getIsDisposed()) {
        throw new Error('The Scheduler has been disposed.');
      }

      const wrappedAction = () => {
        try {
          actionToRepeat();
        } catch (e) {}
      };

      const token = setInterval(wrappedAction, millisecondInterval);
      this._intervalBindings[token] = Disposable.fromAction(() => {
        clearInterval(token);
        delete this._intervalBindings[token];
      });
      return this._intervalBindings[token];
    }
    /**
     * Attempts an action, repeating if necessary, using an exponential backoff.
     *
     * @public
     * @param {Function} actionToBackoff - The action to attempt. If it fails -- because an error is thrown, a promise is rejected, or the function returns a falsey value -- the action will be invoked again.
     * @param {number=} millisecondDelay - The amount of time to wait to execute the action. Subsequent failures are multiply this value by 2 ^ [number of failures]. So, a 1000 millisecond backoff would schedule attempts using the following delays: 0, 1000, 2000, 4000, 8000, etc. If not specified, the first attempt will execute immediately, then a value of 1000 will be used.
     * @param {string=} actionDescription - Description of the action to attempt, used for logging purposes.
     * @param {number=} maximumAttempts - The number of attempts to before giving up.
     * @param {Function=} failureCallback - If provided, will be invoked if a function is considered to be failing.
     * @param {Object=} failureValue - If provided, will consider the result to have failed, if this value is returned (a deep equality check is used). If not provided, an undefined value will trigger a retry.
     * @returns {Promise}
     */


    backoff(actionToBackoff, millisecondDelay, actionDescription, maximumAttempts, failureCallback, failureValue) {
      return Promise.resolve().then(() => {
        assert.argumentIsRequired(actionToBackoff, 'actionToBackoff', Function);
        assert.argumentIsOptional(millisecondDelay, 'millisecondDelay', Number);
        assert.argumentIsOptional(actionDescription, 'actionDescription', String);
        assert.argumentIsOptional(maximumAttempts, 'maximumAttempts', Number);
        assert.argumentIsOptional(failureCallback, 'failureCallback', Function);

        if (this.getIsDisposed()) {
          throw new Error('The Scheduler has been disposed.');
        }

        const processAction = attempts => {
          return Promise.resolve().then(() => {
            let delay;

            if (attempts === 0) {
              delay = 0;
            } else {
              delay = (millisecondDelay || 1000) * Math.pow(2, attempts - 1);
            }

            return this.schedule(actionToBackoff, delay, `Attempt [ ${attempts} ] for [ ${actionDescription || 'unnamed action'} ]`);
          }).then(result => {
            let resultPromise;

            if (!is.undefined(failureValue) && object.equals(result, failureValue)) {
              resultPromise = Promise.reject(`Attempt [ ${attempts} ] for [ ${actionDescription || 'unnamed action'} ] failed due to invalid result`);
            } else {
              resultPromise = Promise.resolve(result);
            }

            return resultPromise;
          }).catch(e => {
            if (is.fn(failureCallback)) {
              failureCallback(attempts);
            }

            return Promise.reject(e);
          });
        };

        let attempts = 0;

        const processActionRecursive = () => {
          return processAction(attempts++).catch(e => {
            if (maximumAttempts > 0 && attempts === maximumAttempts) {
              let message = `Maximum failures reached for ${actionDescription || 'unnamed action'}`;
              let rejectPromise;

              if (is.object(e)) {
                e.backoff = message;
                rejectPromise = Promise.reject(e);
              } else {
                rejectPromise = Promise.reject(message);
              }

              return rejectPromise;
            } else {
              return processActionRecursive();
            }
          });
        };

        return processActionRecursive();
      });
    }

    _onDispose() {
      object.keys(this._timeoutBindings).forEach(key => {
        this._timeoutBindings[key].dispose();
      });
      object.keys(this._intervalBindings).forEach(key => {
        this._intervalBindings[key].dispose();
      });
      this._timeoutBindings = null;
      this._intervalBindings = null;
    }

    static schedule(actionToSchedule, millisecondDelay, actionDescription) {
      const scheduler = new Scheduler();
      scheduler.schedule(actionToSchedule, millisecondDelay, actionDescription).then(result => {
        scheduler.dispose();
        return result;
      }).catch(e => {
        scheduler.dispose();
        throw e;
      });
    }

    toString() {
      return '[Scheduler]';
    }

  }

  return Scheduler;
})();

},{"./../lang/Disposable":23,"./../lang/assert":30,"./../lang/is":36,"./../lang/object":40,"./../lang/promise":41}],139:[function(require,module,exports){
const assert = require('./../lang/assert'),
      Disposable = require('./../lang/Disposable'),
      promise = require('./../lang/promise');

const Queue = require('./../collections/Queue');

module.exports = (() => {
  'use strict';
  /**
   * A work queue that processes actions in sequence.
   *
   * @public
   * @extends {Disposable}
   */

  class Serializer extends Disposable {
    constructor() {
      super();
      this._workQueue = new Queue();
      this._enqueued = 0;
      this._processed = 0;
      this._running = false;
    }
    /**
     * Gets the sequence of the item that was last processed.
     *
     * @public
     * @returns {Number}
     */


    getCurrent() {
      return this._processed;
    }
    /**
     * The the total number of items that have been added to the queue.
     *
     * @public
     * @returns {Number}
     */


    getTotal() {
      return this._enqueued;
    }
    /**
     * The number of items that are currently pending.
     *
     * @public
     * @returns {Number}
     */


    getPending() {
      return this._enqueued - this._processed;
    }
    /**
     * Indicates if a work item is currently being processed.
     * 
     * @public
     * @returns {Boolean}
     */


    getRunning() {
      return this._running;
    }
    /**
     * Adds a new action to the processing queue. If the action
     * is asynchronous, the action should return a promise.
     *
     * @public
     * @param {Function} actionToEnqueue
     * @returns {Promise} - A promise which resolves once the action has been processed.
     */


    enqueue(actionToEnqueue) {
      return promise.build((resolveCallback, rejectCallback) => {
        assert.argumentIsRequired(actionToEnqueue, 'actionToEnqueue', Function);

        if (this.getIsDisposed()) {
          throw new Error('Unable to add action to the Serializer, it has been disposed.');
        }

        this._enqueued = this._enqueued + 1;

        this._getWorkQueue().enqueue(() => {
          return Promise.resolve().then(() => {
            if (this.getIsDisposed()) {
              throw new Error('Unable to process Serializer action, the serializer has been disposed.');
            }

            this._processed = this._processed + 1;
            return actionToEnqueue();
          }).then(result => {
            resolveCallback(result);
          }).catch(error => {
            rejectCallback(error);
          });
        });

        checkStart.call(this);
      });
    }
    /**
     * Allows an inheriting class to override the internal {@link Queue} implementation.
     * 
     * @protected
     * @returns {Queue|*}
     */


    _getWorkQueue() {
      return this._workQueue;
    }

    toString() {
      return '[Serializer]';
    }

  }

  function checkStart() {
    const workQueue = this._getWorkQueue();

    if (workQueue.empty() || this._running) {
      return;
    }

    this._running = true;
    const actionToExecute = workQueue.dequeue();
    actionToExecute().then(() => {
      this._running = false;
      checkStart.call(this);
    });
  }

  return Serializer;
})();

},{"./../collections/Queue":5,"./../lang/Disposable":23,"./../lang/assert":30,"./../lang/promise":41}],140:[function(require,module,exports){
const assert = require('./../lang/assert');

module.exports = (() => {
  'use strict';

  class WindowCounter {
    constructor(duration, windows) {
      assert.argumentIsRequired(duration, 'duration', Number);
      assert.argumentIsRequired(windows, 'windows', Number);
      this._duration = duration;
      this._windows = [new Window(getTime(), this._duration)];
      this._maximum = Math.max(windows, 2);
      this._previousCount = 0;
    }

    increment(count) {
      assert.argumentIsRequired(count, 'count', Number);
      advance.call(this).increment(count);
    }

    getCurrent() {
      return advance.call(this).getCount();
    }

    getPrevious() {
      advance.call(this);
      let returnVal;

      if (this._windows.length > 1) {
        returnVal = this._windows[1].getCount();
      } else {
        returnVal = 0;
      }

      return returnVal;
    }

    getAverage() {
      const current = advance.call(this);
      const previousWindows = this._windows.length - 1;
      let returnVal;

      if (previousWindows > 0) {
        returnVal = this._previousCount / previousWindows;
      } else {
        returnVal = 0;
      }

      return returnVal;
    }

    toString() {
      return '[WindowCounter]';
    }

  }

  function advance() {
    const now = getTime();

    while (!this._windows[0].contains(now)) {
      const previous = this._windows[0];
      const current = new Window(previous.getEnd(), this._duration);

      this._windows.unshift(current);

      this._previousCount = this._previousCount + previous.getCount();

      if (this._windows.length > this._maximum) {
        const removed = this._windows.pop();

        this._previousCount = this._previousCount - removed.getCount();
      }
    }

    return this._windows[0];
  }

  function getTime() {
    return new Date().getTime();
  }

  class Window {
    constructor(start, duration) {
      this._start = start;
      this._end = start + duration;
      this._count = 0;
    }

    contains(now) {
      return !(now < this._start || now > this._end);
    }

    increment(count) {
      this._count = this._count + count;
    }

    getStart() {
      return this._start;
    }

    getEnd() {
      return this._end;
    }

    getCount() {
      return this._count;
    }

  }

  return WindowCounter;
})();

},{"./../lang/assert":30}]},{},[75,76,77,78,81,82,83,84,85,86,87,88,79,80,89,90,91,92,100,101,102,103,93,94,95,96,104,105,106,107,108,109,110,111,112,97,113,98,99,114,115,116,117,119,118,120,121,131,132,122,123,124,125,126,127,128,129,130,133,134,135,136]);
