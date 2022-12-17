import { EventEmitter, Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class ImageCanvasEditingService {
    imagePathChangedEvent: EventEmitter<JSON> = new EventEmitter();
    dataJSON: JSON;

    setImagePath(newDataJSON: JSON) {
        this.dataJSON = newDataJSON;
        console.log(this.dataJSON)
        this.imagePathChangedEvent.emit(newDataJSON);
    }

    getImagePath() {
        return this.dataJSON;
    }
}