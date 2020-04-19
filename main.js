'use strict';

/*
 * Created with @iobroker/create-adapter v1.23.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');


// Load your modules here, e.g.:
const api = require('nextcloud-node-client');

let pass = "";




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
			// Check if credentials are not empty and decrypt stored password
			if (await this.getSettings()) {

				await this.getData();

				// setInterval(async () => {
				// 	await this.getData();
				// }, this.config.nextcloudPollingInterval * 1000);

			} else {
				this.log.error("*** Adapter deactivated, credentials missing in Adaptper Settings !!!  ***");
				this.setForeignState("system.adapter." + this.namespace + ".alive", false);
			}

			// // Initialize your adapter here

			// // The adapters config (in the instance object everything under the attribute "native") is accessible via
			// // this.config:
			// this.log.info('config option1: ' + this.config.option1);
			// this.log.info('config option2: ' + this.config.option2);

			// /*
			// For every state in the system there has to be also an object of type state
			// Here a simple template for a boolean variable named "testVariable"
			// Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
			// */
			// await this.setObjectAsync('testVariable', {
			// 	type: 'state',
			// 	common: {
			// 		name: 'testVariable',
			// 		type: 'boolean',
			// 		role: 'indicator',
			// 		read: true,
			// 		write: true,
			// 	},
			// 	native: {},
			// });

			// // in this template all states changes inside the adapters namespace are subscribed
			// this.subscribeStates('*');

			// /*
			// setState examples
			// you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
			// */
			// // the variable testVariable is set to true as command (ack=false)
			// await this.setStateAsync('testVariable', true);

			// // same thing, but the value is flagged "ack"
			// // ack should be always set to true if the value is received from or acknowledged from the target system
			// await this.setStateAsync('testVariable', { val: true, ack: true });

			// // same thing, but the state is deleted after 30s (getState will return null afterwards)
			// await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

			// // examples for the checkPassword/checkGroup functions
			// let result = await this.checkPasswordAsync('admin', 'iobroker');
			// this.log.info('check user admin pw iobroker: ' + result);

			// result = await this.checkGroupAsync('admin', 'admin');
			// this.log.info('check group user admin group admin: ' + result);

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

	async getData() {
		let connection = await this.checkConnection();

		if (connection && connection.isConnected && connection.client) {
			this.log.info('Connection to Nextcloud successful. Loading data...');


			// this.log.warn('System Infos');
			// this.log.info(JSON.stringify(connection.systemInfos.nextcloud));

			// let systemBasicData = await connection.client.getSystemBasicData();
			// this.log.info(JSON.stringify(systemBasicData));

			// this.log.warn('Notification')
			// let notifications = await connection.client.getNotifications();
			// this.log.info(JSON.stringify(notifications));

			// let updateNotifications = await connection.client.getUpdateNotifications(connection.systemInfos.nextcloud.system['version']);
			// this.log.info(JSON.stringify(updateNotifications));

			// await connection.client.sendNotificationToUser({ userId: 'Scrounger', shortMessage: 'Nachricht', longMessage: "Now was langes hinter her!" });


			// this.log.warn('Apps Infos');
			// let apps = await connection.client.getApps();
			// this.log.info(JSON.stringify(apps));

			// let appInfo = await connection.client.getAppInfos("updatenotification");
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

			let test = await connection.client.getUserIDs();

			this.log.info(JSON.stringify(test));



		}
	}

	async getSettings() {
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
				pass = this.decrypt(obj.native.secret, this.config.nextcloudUserPassword);
			} else {
				//noinspection JSUnresolvedVariable
				pass = this.decrypt("Zgfr56gFe87jJOM", this.config.nextcloudUserPassword);
			}

			process.env.NEXTCLOUD_PASSWORD = pass;
		} else {
			this.log.warn(`no user password defined in  Adaptper Settings!`);
		}

		if (this.config.nextcloudUrl !== "" && this.config.nextcloudUserName !== "" && pass !== "") {
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