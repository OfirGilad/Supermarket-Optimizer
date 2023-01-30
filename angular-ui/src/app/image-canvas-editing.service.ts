import { EventEmitter, Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class ImageCanvasEditingService {
    imagePathChangedEvent: EventEmitter<JSON> = new EventEmitter();
    newSelectedProductEvent: EventEmitter<JSON> = new EventEmitter();
    dataJSON: JSON;
    newProductsJSON: JSON;

    setImagePath(newDataJSON: JSON) {
        this.dataJSON = newDataJSON;
        console.log(this.dataJSON)
        this.imagePathChangedEvent.emit(newDataJSON);
    }
    
    setNewProducts(newNewProductsJSON: JSON) {
        this.newProductsJSON = newNewProductsJSON;
        //console.log(this.productsJSON)
        this.newSelectedProductEvent.emit(newNewProductsJSON);
    }

    getImagePath() {
        return this.dataJSON;
    }
}