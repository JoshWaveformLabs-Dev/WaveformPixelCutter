export const DataDrivenScreenClosedReason = {
    ServerClosed: "ServerClosed", ClientClosed: "ClientClosed", UserBusy: "UserBusy",
}
export class ObservableString {
    constructor(value) { this.value = value }
    setData(value) { this.value = value }
    getData() { return this.value }
}
export class ObservableBoolean extends ObservableString {}
export class ObservableNumber extends ObservableString {
    listeners = new Set()
    constructor(value, options) { super(value); this.clientWritable = options?.clientWritable ?? false }
    setData(value) {
        if (value === this.value) return
        super.setData(value)
        for (const listener of this.listeners) listener(value)
    }
    subscribe(listener) { this.listeners.add(listener); return listener }
    unsubscribe(listener) { return this.listeners.delete(listener) }
}

export class CustomForm {
    controls = []
    visible = false
    constructor(player, title) { Object.assign(this, { player, title }) }
    label(text, options) { this.controls.push({ type: "label", text, ...options }); return this }
    header(text, options) { this.controls.push({ type: "header", text, ...options }); return this }
    dropdown(text, value, items, options) {
        if (!value.clientWritable) throw Error("A dropdown needs a client-writable observable")
        this.controls.push({ type: "dropdown", text, value, items, ...options })
        return this
    }
    button(text, click, options) { this.controls.push({ type: "button", text, click, ...options }); return this }
    closeButton() { this.controls.push({ type: "close" }); return this }
    isShowing() { return this.visible }
    show() {
        this.player.forms ??= []
        this.player.forms.push(this)
        this.visible = true
        return new Promise(resolve => { this.resolve = resolve })
    }
    dismiss(reason = DataDrivenScreenClosedReason.ClientClosed) {
        this.visible = false
        this.resolve(reason)
    }
    close() { this.dismiss(DataDrivenScreenClosedReason.ServerClosed) }
}
