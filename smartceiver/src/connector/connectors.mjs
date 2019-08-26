// class Connectors {
// 	constructor() { this._reg = {} }

// 	register(connector) { this._reg[connector.constructor.id] = connector }
// 	get(id) { return this._reg[id] }

// 	get all() { return Object.values(this._reg) }
// }

// var connectors = new Connectors()

export const get = async (id) => {
	if (!id) return null
	if (id === 'RTC') {
		const conn = await import('./remotig-rtc-connector.mjs')
		return new conn.RemotigRTCConnector()
	}
	if (id === 'USB') {
		const conn = await import('./usb-connector.mjs')
		return new conn.WebUSBConnector()
	}

	throw new Error(`Unknown Connector.id=${id}`)
}