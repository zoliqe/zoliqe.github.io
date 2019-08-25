class ConnectorRegister {
	constructor() { this._reg = {} }

	register(connector) { this._reg[connector.constructor.id] = connector }
	get(id) { return this._reg[id] }

	get all() { return Object.values(this._reg) }
}

var connectors = new ConnectorRegister()
