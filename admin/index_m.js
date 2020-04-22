var myNamespace = null;
var retryTimer = [];
var secret;

// This will be called by the admin adapter when the settings page loads
function load(settings, onChange) {
    myNamespace = adapter + '.' + instance;

    // example: select elements with id=key and class=value and insert value
    if (!settings) return;
    socket.emit('getObject', 'system.config', function (err, obj) {
        secret = (obj.native ? obj.native.secret : '') || 'Zgfr56gFe87jJOM';
        loadHelper(settings, onChange);
    });

    let checkboxLists = [
        {
            // system
            id: `${myNamespace}.info`,
            property: 'system',
            defaults: ["version", "freespace", "cpuload", "mem_total", "mem_free"],
            ignores: ["version"],
            parentContainerId: 'container_system'
        },
        {
            // server
            id: `${myNamespace}.info`,
            property: 'server',
            defaults: ["webserver", "php", "database"],
            parentContainerId: 'container_server'
        },
        {
            // storage
            id: `${myNamespace}.info`,
            property: 'storage',
            defaults: ["num_users", "num_files", "num_storages", "num_storages_local"],
            parentContainerId: 'container_storage'
        },
        {
            // shares
            id: `${myNamespace}.info`,
            property: 'shares',
            defaults: ["num_shares", "num_shares_user", "num_shares_groups", "num_shares_link"],
            parentContainerId: 'container_shares'
        }
    ]

    for (const options of checkboxLists) {
        generateCheckboxList(options, settings, onChange)
    }

    showHideSettings();

    onChange(false);

    // reinitialize all the Materialize labels on the page if you are dynamically adding inputs:
    if (M) M.updateTextFields();
}

function showHideSettings() {
    $("[id*=enable]").each(function () {
        let key = $(this).attr('id').replace('enable', '').toLowerCase();

        $(this).on('change', function () {
            if ($(this).prop('checked') === true) {
                $(`#container_${key}`).show();
            } else {
                $(`#container_${key}`).hide();
            }
        });
    });
}


// This will be called by the admin adapter when the user presses the save button
function save(callback) {
    // example: select elements with class=value and build settings object
    var obj = {};
    $('.value').each(function () {
        var $this = $(this);
        var id = $this.attr('id');
        if ($this.attr('type') === 'checkbox') {
            obj[id] = $this.prop('checked');
        } else {
            var value = $this.val();
            if (id === 'nextcloudUserPassword') {
                value = encrypt(secret, value);
            }
            obj[id] = value;
        }
    });

    // create empty arrays for all checkbox list
    $("[id*=_checkbox_list]").each(function () {
        let property = $(this).attr('id').replace('_checkbox_list', '');
        obj[property] = [];
    });

    // dynamic add items if checkbox is checked
    $("[class*=_checkbox_item]").each(function () {
        let property = $(this).attr('class').replace('_checkbox_item', '');

        if ($(this).prop('checked')) {
            if (obj.hasOwnProperty(property)) {
                obj[property].push($(this).data('info'));
            }
        }
    });

    callback(obj);
}

function loadHelper(settings, onChange) {
    // example: select elements with id=key and class=value and insert value
    if (!settings) return;
    $('.value').each(function () {
        var $key = $(this);
        var id = $key.attr('id');
        if (id === 'nextcloudUserPassword') {
            settings[id] = decrypt(secret, settings[id]);
        }
        if ($key.attr('type') === 'checkbox') {
            // do not call onChange direct, because onChange could expect some arguments
            $key.prop('checked', settings[id]).change(function () {
                onChange();
            });
        } else {
            // do not call onChange direct, because onChange could expect some arguments
            $key.val(settings[id]).change(function () {
                onChange();
            }).keyup(function () {
                onChange();
            });
        }
    });
    onChange(false);
    // function Materialize.updateTextFields(); to reinitialize all the Materialize labels on the page if you are dynamically adding inputs.
    M.updateTextFields();
}

function encrypt(key, value) {
    var result = '';
    for (var i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}
function decrypt(key, value) {
    var result = '';
    for (var i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

/**
 * @param {object} options				-> see options parameter below 
 * @param {object} settings				-> settings des Adapters
 * @param {object} onChange				-> onChange Event des Adapters
 * 
 * options parameter --------------------------------------------------------------------------------------------------------------------------------------------------
 * @param {string} id					-> id of datapoint which has an array in native object to be used for the checkbox list
 * @param {string} property				-> name of the array in native object, property name where the selected items store must have the same name in io-package.json
 * @param {Array<string>} defaults		-> default selection used by default button -> if no default is defined, button will hide
 * @param {Array<string>} ignores		-> will be ignore by creating the checkbox list
 * @param {string} parentContainerId    -> id of parent container where the checklist should be added to.
 */
function generateCheckboxList(options, settings, onChange) {
    try {
        $(`#${options.parentContainerId}`).html(
            `<div class="col s12 ${options.property}_button_panel checkbox_list_buttons_container">
                <a id="${options.property}_button_default" class="waves-effect waves-light btn-small checkbox_list_button"><i
                        class="material-icons left">settings_backup_restore</i><span
                        class="translate">${_("default")}</span></a>
                <a id="${options.property}_button_all" class="waves-effect waves-light btn-small checkbox_list_button"><i
                        class="material-icons left">check_box</i><span class="translate">${_("selectAll")}</span></a>
                <a id="${options.property}_button_none" class="waves-effect waves-light btn-small checkbox_list_button"><i
                        class="material-icons left">check_box_outline_blank</i><span
                        class="translate">${_("selectNone")}</span></a>
            </div>
            <div class="col s12 checkbox_list" id="${options.property}_checkbox_list">
                <div class="progress">
                    <div class="indeterminate"></div>
                </div>
                <h6 class="center translate">${_("notYetAvailable")}</h6>
            </div>`
        )

        // Read all available datapoints from object
        getObject(options.id, (err, state) => {

            // If native has not the array, loop until array is available
            if (!state.native[options.property]) {

                // Reset timer (if running) and start new one for next polling interval
                if (retryTimer[options.property]) {
                    clearTimeout(retryTimer[options.property]);
                    retryTimer[options.property] = null;
                }

                retryTimer[options.property] = setTimeout(() => {
                    generateCheckboxList(options.id, options.property, settings);
                }, 1000);

                $(`.${options.property}_button_panel`).hide();
            } else {
                // native has array -> create checkbox list

                if (retryTimer[options.property]) {
                    clearTimeout(retryTimer[options.property]);
                    retryTimer[options.property] = null;
                }

                let checkboxElementsList = [];
                let availableDatapoints = state.native[options.property];

                if (availableDatapoints) {
                    availableDatapoints = availableDatapoints.sort();

                    for (const datapoint of availableDatapoints) {
                        if (options.ignores && !options.ignores.includes(datapoint) || !options.ignores) {
                            checkboxElementsList.push(
                                `<label class="col s4 input-field checkbox_list_item">
                                    <input type="checkbox" class="${options.property}_checkbox_item" ${settings[options.property].indexOf(datapoint) !== -1 ? 'checked ' : ''} data-info="${datapoint}" />
                                    <span class="black-text">${_(datapoint)}</span>
                                </label>`
                            )
                        }
                    }
                    $(`#${options.property}_checkbox_list`).html(checkboxElementsList.join(""));

                    $(`.${options.property}_button_panel`).show();
                }
            }

            $(`.${options.property}_checkbox_item`).on('change', function () {
                onChange()
            });

            if (options.defaults && options.defaults.length > 0) {
                $(`#${options.property}_button_default`).on('click', function () {
                    $(`.${options.property}_checkbox_item`).each(function () {
                        let $this = $(this);

                        if (options.defaults.includes($this.data('info'))) {
                            $this.prop('checked', true);
                        } else {
                            $this.prop('checked', false);
                        }

                        onChange();
                    });
                });
                $(`#${options.property}_button_default`).show();
            } else {
                $(`#${options.property}_button_default`).hide();
            }

            $(`#${options.property}_button_all`).on('click', function () {
                $(`.${options.property}_checkbox_item`).each(function () {
                    $(this).prop('checked', true);
                    onChange();
                });
            });

            $(`#${options.property}_button_none`).on('click', function () {
                $(`.${options.property}_checkbox_item`).each(function () {
                    $(this).prop('checked', false);
                    onChange();
                });
            });


            // reinitialize all the Materialize labels on the page if you are dynamically adding inputs:
            M && M.updateTextFields();
        });
    } catch (err) {
        console.error(`[generateCheckboxList] id: '${options.id}', property: '${options.property}', error: ${err.message}, stack: ${err.stack}`);
    }
}