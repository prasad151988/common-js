var Tree = require('./../../../collections/Tree');

describe('When a Tree is constructed', function() {
	'use strict';

	var root;
	var one;

	beforeEach(function() {
		root = new Tree(one = { });
	});

	it('should be the root node', function() {
		expect(root.getIsRoot()).toEqual(true);
	});

	it('should be a leaf node', function() {
		expect(root.getIsLeaf()).toEqual(true);
	});

	it('should have to correct node value', function() {
		expect(root.getValue()).toBe(one);
	});

	describe('and a child is added', function() {
		var child;
		var two;

		beforeEach(function() {
			child = root.addChild(two = { });
		});

		it('should be a leaf node', function() {
			expect(child.getIsLeaf()).toEqual(true);
		});

		it('should have to correct node value', function() {
			expect(child.getValue()).toBe(two);
		});

		it('should should be the child of the root node', function() {
			expect(child.getParent()).toBe(root);
		});

		it('should not have a parent which is considered a leaf node', function() {
			expect(root.getIsLeaf()).toEqual(false);
		});

		it('should be in the parents collection of children', function() {
			expect(root.getChildren().find((c) => c === child)).toBe(child);
		});

		describe('and a second child is added', function() {
			var secondChild;
			var three;

			beforeEach(function() {
				secondChild = root.addChild(three = { });
			});

			describe('and the tree is converted to a JavaScript object', function() {
				var object;

				beforeEach(function() {
					object = root.toJSObj();
				});

				it('should have the correct root value', function() {
					expect(object.value).toBe(one);
				});

				it('should have two children', function() {
					expect(object.children.length).toEqual(2);
				});

				it('should have the correct value for the first child', function() {
					expect(object.children[0].value).toBe(two);
				});

				it('should have the correct value for the second child', function() {
					expect(object.children[1].value).toBe(three);
				});

				it('the first child should have no children', function() {
					expect(object.children[0].children.length).toEqual(0);
				});

				it('the second child should have no children', function() {
					expect(object.children[1].children.length).toEqual(0);
				});
			});
		});
	});
});