export const DataDrivenScreenClosedReason = {
    ServerClosed: "ServerClosed", ClientClosed: "ClientClosed", UserBusy: "UserBusy",
}
export class ObservableString {
    constructor(value) { this.value = value }
    setData(value) { this.value = value }
    getData() { return this.value }
}
export class ObservableBoolean extends ObservableString {}

export class CustomForm {
    buttons = []
    labels = []
    images = []
    visible = false
    constructor(player, title) { Object.assign(this, { player, title }) }
    label(text) { this.labels.push(text); return this }
    header() { return this }
    divider() { return this }
    image(src, pack) { this.images.push({ src, pack }); return this }
    button(label, click, options) { this.buttons.push({ label, click, ...options }); return this }
    closeButton() { return this }
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
