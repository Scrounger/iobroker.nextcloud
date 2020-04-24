'use strict';

/*
 * Created with @iobroker/create-adapter v1.23.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');


// Load your modules here, e.g.:
const api = require('nextcloud-node-client');
const words = require('./admin/words.js');

let availableData = null;
let language = 'en';
let _ = null;

let blacklist = {
	system: ['theme', 'enable_avatars', 'enable_previews', 'memcache.local', 'memcache.distributed', 'filelocking.enabled', 'memcache.locking', 'debug', 'apps'],
}

// blacklist for objects where sub properties should not be iterate and available as single datapoint selection
let objectblacklist = {
	system: ['cpuload'],
	apps: ['app_updates']
}

let stringValues = ['version']
let bytesToGB = ['freespace', 'php.upload_max_filesize', 'php.memory_limit'];
let bytesToMB = ['database.size'];
let kBytesToGB = ['mem_free', 'mem_total', 'swap_free', 'swap_total'];


// https://10.0.124.223/apps/contacts/img/app.svg
//https://10.0.124.223/svg/contacts/app?color=000000

class Nextcloud extends utils.Adapter {

	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'nextcloud',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('objectChange', this.onObjectChange.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		try {
			await this.prepareTranslation();

			// Check if credentials are not empty and decrypt stored password
			if (await this.getSettings()) {
				let connection = await this.checkConnection();

				await this.getAvailableData(connection);

				this.getData();
			} else {
				this.log.error("*** Adapter deactivated, credentials missing in Adaptper Settings !!!  ***");
				this.setForeignState("system.adapter." + this.namespace + ".alive", false);
			}
		} catch (ex) {
			this.log.error(`error: ${ex.message}, stack: ${ex.stack}`);
		}
	}

	/**
	 * Function to decrypt passwords
	 * @param {string | { charCodeAt: (arg0: number) => number; }[]} key
	 * @param {string} value
	 */
	decrypt(key, value) {
		let result = "";
		for (let i = 0; i < value.length; ++i) {
			result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
		}
		this.log.debug("client_secret decrypt ready");
		return result;
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.log.info('cleaned everything up...');
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed object changes
	 * @param {string} id
	 * @param {ioBroker.Object | null | undefined} obj
	 */
	onObjectChange(id, obj) {
		if (obj) {
			// The object was changed
			this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
		} else {
			// The object was deleted
			this.log.info(`object ${id} deleted`);
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	/**
	 * @param {object} connection
	 */
	async getAvailableData(connection) {

		if (connection.isConnected && connection.client) {
			availableData = {};

			this.getAvailableDataFromObject(connection.systemInfos.server, 'server');

			this.getAvailableDataFromObject(connection.systemInfos.nextcloud.system, 'system');
			this.getAvailableDataFromObject(connection.systemInfos.nextcloud.storage, 'storage');
			this.getAvailableDataFromObject(connection.systemInfos.nextcloud.shares, 'shares');

			this.getAvailableDataFromObject(connection.systemInfos.nextcloud.system.apps, 'apps');


			let updateObj = await this.getObjectAsync('info');
			if (updateObj) {
				updateObj.native = availableData;

				await this.setObjectAsync('info', updateObj);
				this.log.info(`Successful updating avaiable datapoint infos!`);
			} else {
				this.log.error(`datapoint '${this.namespace}.info' not exist!`);
			}
		}
	}

	async getData() {
		try {
			let connection = await this.checkConnection();

			if (connection.isConnected) {
				this.log.info('Connection to Nextcloud successful. Loading data...');

				if (connection.systemInfos) {
					await this.createStateForObject(connection.systemInfos.server, 'server');
					await this.createStateForObject(connection.systemInfos.nextcloud.system, 'system');
					await this.createStateForObject(connection.systemInfos.nextcloud.storage, 'storage');
					await this.createStateForObject(connection.systemInfos.nextcloud.shares, 'shares');
					await this.createStateForObject(connection.systemInfos.nextcloud.system.apps, 'apps');
				}

				this.apiTest();

				this.log.info('Loading data successful.');
			}
		} catch (err) {
			this.log.error(`[getData] error: ${err.message}, stack: ${err.stack}`);
		}

	}

	/**
	 * @param {object} obj
	 * @param {string} propName
	 * @param {string} idPrefix
	 */
	async createStateForObject(obj, propName, idPrefix = '') {
		if (idPrefix !== '') {
			idPrefix = idPrefix + '.';
		}

		if (obj) {
			for (const [key, value] of Object.entries(obj)) {
				if (this.config[propName].includes(key) && this.config[`enable${propName}`]) {
					// this.log.info(key);
					await this.createStateCorrectType(key, `${idPrefix}${propName}.${key.toLowerCase()}`, key, value);

				} else if (typeof value === 'object' && this.config[`enable${propName}`]
					&& ((blacklist[propName] && !blacklist[propName].includes(key)) || !blacklist[propName])
					&& ((objectblacklist[propName] && !objectblacklist[propName].includes(key)) || !objectblacklist[propName])) {

					this.log.info(`isObject -> propName: ${propName}, key: ${key}`);

					for (const [subkey, subValue] of Object.entries(value)) {

						if (this.config[propName].includes(`${key}.${subkey}`) && this.config[`enable${propName}`]) {

							await this.createStateCorrectType(`${key}.${subkey}`, `${idPrefix}${propName}.${key.toLowerCase()}.${subkey.toLowerCase()}`, subkey, subValue);

						} else {
							if (await this.getObjectAsync(`${this.namespace}.${idPrefix}${propName}.${key.toLowerCase()}.${subkey.toLowerCase()}`)) {
								await this.delObjectAsync(`${this.namespace}.${idPrefix}${propName}.${key.toLowerCase()}.${subkey.toLowerCase()}`);
							}
						}
					}
				} else {
					if (await this.getObjectAsync(`${this.namespace}.${idPrefix}${propName}.${key.toLowerCase()}`)) {
						await this.delObjectAsync(`${this.namespace}.${idPrefix}${propName}.${key.toLowerCase()}`);
					}
				}
			}
		}
	}

	/**
	 * @param {string} key
	 * @param {string} id
	 * @param {string} name
	 * @param {any} value
	 */
	async createStateCorrectType(key, id, name, value) {

		if (key === 'cpuload') {
			await this.createStatisticObjectNumber(id, _(name), '%');
			await this.setStateAsync(id, value[0], true);

		} else if (stringValues.includes(key)) {
			await this.createStatisticObjectString(id, _(name));
			await this.setStateAsync(id, value, true);

		} else if (bytesToMB.includes(key)) {
			await this.createStatisticObjectNumber(id, _(name), 'MB');
			await this.setStateAsync(id, Math.round(value / 1024 / 1024 * 100) / 100, true);

		} else if (bytesToGB.includes(key)) {
			await this.createStatisticObjectNumber(id, _(name), 'GB');
			await this.setStateAsync(id, Math.round(value / 1024 / 1024 / 1024 * 100) / 100, true);

		} else if (kBytesToGB.includes(key)) {
			await this.createStatisticObjectNumber(id, _(name), 'GB');
			await this.setStateAsync(id, Math.round(value / 1024 / 1024 * 100) / 100, true);

		} else if (typeof value === 'object') {
			await this.createStatisticObjectString(id, _(name));
			await this.setStateAsync(id, JSON.stringify(value), true);

		} else {
			if (isNaN(value)) {
				await this.createStatisticObjectString(id, _(name));
				await this.setStateAsync(id, value, true);

			} else {
				await this.createStatisticObjectNumber(id, _(name), '');
				await this.setStateAsync(id, value, true);
			}
		}
	}

	/**
	 * @param {object} obj
	 * @param {string | number} name
	 */
	getAvailableDataFromObject(obj, name) {
		if (obj) {
			if (!availableData[name]) {
				availableData[name] = [];
			}

			for (const [key, value] of Object.entries(obj)) {
				if ((blacklist[name] && !blacklist[name].includes(key)) || !blacklist[name]) {

					if (typeof value === 'object') {
						if ((objectblacklist[name] && !objectblacklist[name].includes(key)) || !objectblacklist[name]) {
							for (const [subkey, subValue] of Object.entries(value)) {
								availableData[name].push(`${key}.${subkey}`);
							}
						} else {
							availableData[name].push(key);
						}
					} else {
						availableData[name].push(key);
					}
				}
			}
		}
	}

	async apiTest() {
		let connection = await this.checkConnection();

		if (connection && connection.isConnected && connection.client) {



			// this.log.warn('System Infos');
			// this.log.info(JSON.stringify(connection.systemInfos.nextcloud));

			// this.log.info(JSON.stringify(connection.systemInfos.server));

			// let systemBasicData = await connection.client.getSystemBasicData();
			// this.log.info(JSON.stringify(systemBasicData));

			// this.log.warn('Notification');
			// let notifications = await connection.client.getNotifications();
			// this.log.info(JSON.stringify(notifications));



			// let updateNotifications = await connection.client.getUpdateNotifications(connection.systemInfos.nextcloud.system['version']);
			// this.log.info(JSON.stringify(updateNotifications));

			// await connection.client.sendNotificationToUser('Scrounger', 'Nachricht', "Now was langes hinter her!");


			// this.log.warn('Apps Infos');
			// let apps = await connection.client.getApps();
			// this.log.info(JSON.stringify(apps));

			// let appInfo = await connection.client.getAppInfos("contacts");
			// this.log.info(JSON.stringify(appInfo));

			// this.log.warn('User Infos');
			// let userDetails = await connection.client.getUserDetails();
			// this.log.info(JSON.stringify(userDetails));

			// this.log.warn('Group Infos');
			// let groups = await connection.client.getGroups();
			// this.log.info(JSON.stringify(groups));

			// let groupDetails = await connection.client.getGroupsDetails();
			// this.log.info(JSON.stringify(groupDetails));

			// let groupDetailsById = await connection.client.getGroupsDetailsByID('admin');
			// this.log.info(JSON.stringify(groupDetailsById));

			// let userDetailsByID = await connection.client.getUserDetailsByID('Scrounger');
			// this.log.info(JSON.stringify(userDetailsByID));

			// let test = await connection.client.getUserIDs();

			// this.log.info(JSON.stringify(test));
		}
	}

	async getSettings() {
		let password = "";

		if (this.config.nextcloudUrl !== "") {
			process.env.NEXTCLOUD_URL = `${this.config.nextcloudUrl}/remote.php/webdav`;
		} else {
			this.log.warn(`no url defined in  Adaptper Settings!`);
		}

		if (this.config.nextcloudUserName !== "") {
			process.env.NEXTCLOUD_USERNAME = this.config.nextcloudUserName;
		} else {
			this.log.warn(`no user name defined in  Adaptper Settings!`);
		}

		if (this.config.nextcloudUserPassword !== "") {
			let obj = await this.getForeignObjectAsync('system.config');

			if (obj && obj.native && obj.native.secret) {
				//noinspection JSUnresolvedVariable
				password = this.decrypt(obj.native.secret, this.config.nextcloudUserPassword);
			} else {
				//noinspection JSUnresolvedVariable
				password = this.decrypt("Zgfr56gFe87jJOM", this.config.nextcloudUserPassword);
			}

			process.env.NEXTCLOUD_PASSWORD = password;
		} else {
			this.log.warn(`no user password defined in  Adaptper Settings!`);
		}

		if (this.config.nextcloudUrl !== "" && this.config.nextcloudUserName !== "" && password !== "") {
			if (this.config.nextcloudIgnoreCertificateErrors) {
				// ignore Certificate Error
				process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = "0";
			}

			return true;
		}

		return false;
	}


	async checkConnection() {
		try {
			const client = new api.Client();
			const systemInfos = await client.getSystemInfo();

			await this.setStateAsync('info.connection', true, true);

			return { isConnected: true, client: client, systemInfos: systemInfos }

		} catch (ex) {
			await this.setStateAsync('info.connection', false, true);
			this.log.error(`[checkConnection] error: ${ex.message}, stack: ${ex.stack}`);

			return { isConnected: false }
		}
	}


	/**
	* @param {string} id
	* @param {string} name
	* @param {any} unit
	*/
	async createStatisticObjectNumber(id, name, unit) {
		let obj = await this.getObjectAsync(id);

		if (obj) {
			if (obj.common.name !== name || obj.common['unit'] !== unit) {
				this.log.info(JSON.stringify(obj));

				obj.common.name = name;
				obj.common['unit'] = unit;

				await this.setObject(id, obj);
			}
		} else {
			await this.setObjectNotExistsAsync(id,
				{
					type: 'state',
					common: {
						name: name,
						desc: 'sql statistic',
						type: 'number',
						unit: unit,
						read: true,
						write: false,
						role: 'value'
					},
					native: {}
				});
		}
	}

	/**
	 * @param {string} id
	 * @param {string} name
	 */
	async createStatisticObjectString(id, name) {
		let obj = await this.getObjectAsync(id);

		if (obj) {
			if (obj.common.name !== name) {
				obj.common.name = name;
				await this.setObject(id, obj);
			}
		} else {
			await this.setObjectNotExistsAsync(id,
				{
					type: 'state',
					common: {
						name: name,
						desc: 'sql statistic',
						type: 'string',
						read: true,
						write: false,
						role: 'value'
					},
					native: {}
				});
		}
	}

	async prepareTranslation() {
		// language for Tranlation
		var sysConfig = await this.getForeignObjectAsync('system.config');
		if (sysConfig && sysConfig.common && sysConfig.common['language']) {
			language = sysConfig.common['language']
		}

		// language Function
		/**
		 * @param {string | number} string
		 */
		_ = function (string) {
			if (words[string]) {
				return words[string][language]
			} else {
				return string;
			}
		}
	}
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.message" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<ioBroker.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Nextcloud(options);
} else {
	// otherwise start the instance directly
	new Nextcloud();
}