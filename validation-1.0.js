/*!
 * @module Validation
 * @requires jquery.js
 */
/**
 *******************************************************
 * rules_sample = {
 * 	text_min: {
 * 		required: true,
 * 		min: 3
 * 	},
 * 	text_max: {
 * 		required: true,
 * 		max: 5
 * 	},
 * 	text_between: {
 * 		required: true,
 * 		between: [4, 8]
 * 	},
 * 	email1: {
 * 		required: true,
 * 		email: true
 * 	},
 * 	email2: {
 * 		required: true,
 * 		equalTo: $('input[name=email1]').eq(0)
 * 	},
 * 	check: {
 * 		required: '' // default value
 * 	},
 * 	radio: {
 * 		required: '' // default value
 * 	},
 * 	textarea: {
 * 		required: true
 * 	}
 * }
 *******************************************************
 */
var Validation = (function() {

	/**
	 * Model
	 */
	var Model = function () {
		this.data = {
			label: '',
			msgs : []
		};
	};
	Model.prototype = {
		setLabel: function (label) {
			if (label) {
				this.data.label = label;
			}
		},
		addErrorMsg: function (msg) {
			this.data.msgs.push(msg);
		},
		getLabel: function () {
			return this.data.label;
		},
		getErrorMsg: function () {
			return this.data.msgs;
		},
		clear: function () {
			this.data.label = '';
			this.data.msgs = [];
		},
		hasErrors: function () {
			return !!this.data.msgs.length;
		}
	};

	/**
	 * View
	 */
	var View = function (options) {
		var defaults = {
			model                 : null,
			errorClass            : 'assist-error',
			assistLabelClass      : 'assist-label',
			assistMsgClass        : 'assist-msg',
			assistMsgCss          : {
				position: 'absolute',
				padding: '5px',
				backgroundColor: "#fee",
				border: 'solid 1px #fcc',
				zIndex: 99999
			},
			assistMsgOffset       : 3,
			duration              : 200,
			alertText             : 'ご入力内容に誤りがあります。',
			useAssist             : false,
			scrollToErrorOnSubmit : true
		};
		this.settings = $.extend(defaults, options);
		this.$assistMsgEl = null;
		this.init();
	};
	View.prototype = {
		init: function () {
			if (this.settings.useAssist) {
				this.setAssistDialog();
			}
		},
		update: function ($el, useAssist) {
			if (this.settings.model.hasErrors()) {
				$el.parent().addClass(this.settings.errorClass);
				if (useAssist) {
					this.showAssistDialog($el);
				}
			} else { 
				$el.parent().removeClass(this.settings.errorClass);
				if (useAssist) {
					this.hideAssistDialog($el);
				}
			}
		},
		setAssistDialog: function () {
			// アシスト表示用の要素をアペンド
			this.$assistMsgEl = $('.' + this.settings.assistMsgClass);
			if (this.$assistMsgEl.length === 0) {
				this.$assistMsgEl = $('<div>')
										.addClass(this.settings.assistMsgClass)
										.hide()
										.css(this.settings.assistMsgCss)
										.appendTo($('body').css({ position:'relative' }));
			}
		},
		showAssistDialog : function ($el) {
			if (!this.settings.useAssist) return;
			var _self = this,
				_label = this.settings.model.getLabel();
			if (_label) {
				_label = '<span class="' + this.settings.assistLabelClass + '">' + _label + '</span><br>';
			}
			this.$assistMsgEl.html(_label + this.settings.model.getErrorMsg().join('<br>'));

			var _top = $el.offset().top - this.$assistMsgEl.height() - $el.height() - this.settings.assistMsgOffset,
				_left = $el.offset().left;

			this.$assistMsgEl
				.css({ top: _top, left: _left })
				.show()
				.stop()
				.animate({
					opacity: 1
				}, {
					duration: _self.settings.duration
				});
		},
		hideAssistDialog : function ($el) {
			if (!this.settings.useAssist) return;
			var _self = this;
			this.$assistMsgEl
				.stop()
				.animate({
					opacity: 0
				}, {
					duration: _self.settings.duration,
					complete: function() { $(this).hide(); }
				});
		},
		alertAndScrollToError: function ($form) {
			alert(this.settings.alertText);
			var $error = $form.find('.' + this.settings.errorClass);
			if ($error.length && $error.eq(0)) {
				$error = $error.eq(0);
				if (this.settings.scrollToErrorOnSubmit) {
					var $el = $error.find('input, textarea, select').eq(0).focus();
					this.showAssistDialog($el); // iPhoneで反応しないケースがあるので
					var _scrollY = $error.offset().top - 30;
					if (this.settings.useAssist) {
						_scrollY -= this.$assistMsgEl.height();
					}
					window.scrollTo(0, _scrollY);
				}
			}
		}
	};

	/**
	 * Controller
	 */
	var Validation = function (options) {
		var defaults = {
			$form                 : $('#assist-form'),
			userRules             : {},
			type                  : '',
			always                : false,
			viewOptions           : {},
			beforeValidateAll     : function () {},
			onValidationFailed    : function () {},
			onValidationSucceeded : function () {},
			strFormElements : [
				'input[type=number]',
				'input[type=email]',
				'input[type=tel]',
				'input[type=text]',
				'input[type=password]',
				'input[type=radio]',
				'input[type=checkbox]',
				'textarea',
				'select'
			]
		};
		this.settings = $.extend(defaults, options);
		this.$formElements = [];
		this.view = null;
		this.model = null;
		this.init();
	};
	Validation.prototype = {
		/**
		 * 初期化
		 */
		init : function () {
			var _self = this,
				_$tmpFormElements = _self.settings.$form.find(this.settings.strFormElements.join(',')),
				_tmpRadioNameCache = {}, // radioのnameをキャッシュする
				_tmpCheckboxNameCache = {}; // checkboxのnameをキャッシュする

			this.model = new Model();
			this.view = new View($.extend(true, this.settings.viewOptions, { model : this.model }));

			// 各フォーム要素にバリデーションを登録
			_$tmpFormElements.each(function (i, elem) {
				var $el = $(this),
					name = $(this).attr('name');

				// ルールがあるか
				if (_self.settings.userRules[name]) {

					$el.wrap($('<span>').addClass('validation_container'));

					// radio ならname単位でまとめる
					// $(this)を$('input[name=radio_group_name]')に差し替える
					if ($el.attr('type') == 'radio') {
						if (!_tmpRadioNameCache[name]) {
							// グループに置き換える
							$el = $('input[name=' + name + ']');
							_tmpRadioNameCache[name] = 1;
						} else { 
							return true;
						}
					}

					// checkbox ならname単位でまとめる
					// $(this)を$('input[name=checkbox_group_name]')に差し替える
					if ($el.attr('type') == 'checkbox') {
						if (!_tmpCheckboxNameCache[name]) {
							// グループに置き換える
							$el = $('input[name="' + name + '"]');
							_tmpCheckboxNameCache[name] = 1;
						} else { 
							return true;
						}
					}

					// サブミット時のみのオプションがなければ
					if (
						_self.settings.always === true ||
						_self.settings.type != 'beforeSubmit' // deprecated
					) {
						$el
							.bind('focus keyup change', function (e) {
								_self.validate($el, _self.settings.userRules[name]);
								_self.view.update($el, true);
							})
							.bind('blur', function (e) {
								_self.view.hideAssistDialog($el);
							})
							.bind('focus', function (e) {
								$el.parent().parent().find('.notice_box').remove();
							});
					} else { 
						$el
							.bind('blur', function (e) {
								_self.view.hideAssistDialog($el);
							});
					}

					_self.$formElements.push($el);
				}
			});

			// サブミット前のチェック
			_self.settings.$form.submit(function () {
				_self.settings.beforeValidateAll();
				
				if (!_self.validateAll()) {
					_self.view.alertAndScrollToError(_self.settings.$form);
					_self.settings.onValidationFailed();
					return false;
				} else { 
					_self.settings.onValidationSucceeded();
				}
			});

			// 初期エラー表示
			this.validateAll();
		},

		/**
		 * @param  {Object}  $el
		 * @param  {Array}   rules
		 * @param  {Boolean} useAssist
		 * @return {Boolean}
		 */
		validate : function ($el, rules, useAssist) {
			var _type = $el.attr('type'),
				_isValid = false,
				_formatOption = null;

			this.model.clear();
			this.model.setLabel($el.attr('data-assist-label'));

			for (var key in rules) {
				_formatOption = null;
				if (this.rules[key]) {
					if (key == 'required') {
						if (_type == 'checkbox') {
							if ($el.filter(':checked').length) {
								_isValid = this.rules[key](1, _type);
							} else { 
								_isValid = this.rules[key]('', _type);
							}
						} else if (_type == 'radio') {
							if ($el.filter(':checked').val()) {
								_isValid = this.rules[key](1, _type);
							} else { 
								_isValid = this.rules[key]('', _type);
							}
						} else if ($el[0].nodeName.toLowerCase() == 'select') {
							_isValid = this.rules[key]($el.find('option:selected').val(), 'select', rules[key]);
						} else { 
							_isValid = this.rules[key]($el.val(), _type);
						}

					} else if (key == 'min' || key == 'max') {
						_isValid = this.rules[key]($el.val(), rules[key]);
						_formatOption = [rules[key]];

					} else if (key == 'between') {
						_isValid = this.rules[key]($el.val(), rules[key][0], rules[key][1]);
						_formatOption = rules[key];

					} else if (key == 'equalTo') {
						_isValid = this.rules[key]($el.val(), rules[key].val());

					} else { 
						_isValid = this.rules[key]($el.val());
					}

					if(!_isValid) {
						this.model.addErrorMsg(this.formatMessage(this.messages[key], _formatOption));
					}
				}
			}

			return !this.model.hasErrors();
		},

		/**
		 * すべてバリデーションに通っているか確認
		 */
		validateAll : function () {
			var _self = this,
				_validAll = true;

			$.each(this.$formElements, function () {
				var name = $(this).attr('name');
				if (_self.settings.userRules[name]) {
					if (!(_self.validate($(this), _self.settings.userRules[name]))) {
						_validAll= false;
					}
					_self.view.update($(this), false);
				}
			});

			return _validAll;
		},

		/**
		 * エラー文のプレースホルダーを置換する
		 * 
		 * @param {String} message
		 * @param {Array} options
		 * @return {String}
		 */
		formatMessage : function(message, options) {
			if (options) {
				for (var i = 0, len = options.length; i < len; i++) {
					message = message.replace('{' + i + '}', options[i]);
				}
			}
			return message;
		},

		/**
		 * バリデーションルール
		 */
		rules : {
			required : function (val, type, defaultVal) {
				switch(type) {
					case 'checkbox':
					case 'radio':
						return val !== '';
						break;
					case 'select':
						return val != defaultVal;
						break;
					default:
						return $.trim(val).length;
				}
			},
			number : function (val) {
				var _val = $.trim(val);
				return !isNaN(_val) && _val.match(/^[\-0-9\.]{1,}$/);
			},
			alphaNumeric : function (val) {
				return $.trim(val).match(/^[a-zA-Z0-9]{1,}$/);
			},
			email : function (val) {
				return /^([*+!.&#$|\'\\%\/0-9a-z^_`{}=?~:-]+)@(([0-9a-z-]+\.)+[0-9a-z]{2,})$/i.test($.trim(val));
			},
			min: function(val, min) {
				return $.trim(val).length >= min;
			},
			max: function(val, max) {
				return $.trim(val).length <= max;
			},
			between: function(val, min, max) {
				var len = $.trim(val).length;
				return len >= min && len <= max;
			},
			equalTo: function(val, targetVal) {
				return val == targetVal;
			}
		},

		/**
		 * エラーメッセージ
		 */
		messages : {
			required     : '必須項目です',
			email        : '正しいメールアドレスを入力してください',
			url          : '正しいURLを入力してください',
			date         : '正しい日付を入力してください',
			number       : '数字で入力してください',
			alphaNumeric : '半角英数字で入力してください',
			equalTo      : '入力内容が一致しません',
			max          : '{0}文字以内で入力してください',
			min          : '{0}文字以上で入力してください ',
			between      : '{0}文字以上{1}文字以内で入力してください'
		},
		getModel: function () {
			return this.settings.model;
		},
		getView: function () {
			return this.settings.view;
		}
	};

	return Validation;
})();
