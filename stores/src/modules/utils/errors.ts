
/**
 * Extends the Error class
 */
export class Exception extends Error {
	private _obj: any;
	constructor(obj: any) {
		super("");
		this._obj = obj;
		Object.assign(this, obj);
		Object.setPrototypeOf(this, Exception.prototype);
	}

	public toString(): string {
		try {
			return JSON.stringify(this._obj);
		} catch (err) {
			return "Error parsing JSON";
		}
	}

	public toJSON(): any {
		return this._obj;
	}
}