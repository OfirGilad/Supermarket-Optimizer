import { EventEmitter, Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class ImageCanvasEditingService {
    imagePathChangedEvent: EventEmitter<JSON> = new EventEmitter();
    newSelectedProductEvent: EventEmitter<JSON> = new EventEmitter();
    dataJSON: JSON;
    newSelectedProductsJSON: JSON;

    setImagePath(newDataJSON: JSON) {
        this.dataJSON = newDataJSON;
        //console.log(this.dataJSON)
        this.imagePathChangedEvent.emit(newDataJSON);
    }
    
    setNewSelectedProducts(newNewSelectedProductsJSON: JSON) {
        this.newSelectedProductsJSON = newNewSelectedProductsJSON;
        //console.log(this.productsJSON)
        this.newSelectedProductEvent.emit(newNewSelectedProductsJSON);
    }
}