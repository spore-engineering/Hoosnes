
import CoreStoreDispatcher from './CoreStoreDispatcher';
import {ReduceStore} from 'flux/utils';
import CoreStoreActions, {Types} from './CoreStoreActions';
import Event from "typescript.events";

export class CoreStore extends Event {

    constructor() {
        super();
    }

    public addChangeListener(callback) {
        this.on('change', callback);
    }

    public removeChangeListener(callback) {
        this.removeListener('change', callback);
    }

    public handleAction(action) {
        switch (action.type) {
            case Types.REBUILD:
            default:
                console.log('handleAction', action);
        }
    }

    public register() {
        console.log('register', 'ready');
        CoreStoreDispatcher.register(coreStore.handleAction.bind(coreStore));
    }

}

const coreStore = new CoreStore();
export default coreStore;
