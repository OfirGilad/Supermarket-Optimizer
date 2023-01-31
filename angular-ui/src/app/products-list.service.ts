import { EventEmitter, Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ProductsListService {
  requestPathEvent: EventEmitter<JSON> = new EventEmitter();
  selectedProductEvent: EventEmitter<JSON> = new EventEmitter();
  productAddedEvent: EventEmitter<JSON> = new EventEmitter();
  productRemovedEvent: EventEmitter<JSON> = new EventEmitter();
  requestedProductsJSON: JSON;
  recentProductStatus: JSON;
  updatedProductsListJSON: JSON;

  requestPath(newRequestedProductsJSON: JSON) {
      this.requestedProductsJSON = newRequestedProductsJSON;
      //console.log(this.productsJSON)
      this.requestPathEvent.emit(newRequestedProductsJSON);
  }

  setSelectedProduct(newSelectedProductJSON: JSON) {
    this.recentProductStatus = newSelectedProductJSON;
    //console.log(this.recentProductStatus)
    this.selectedProductEvent.emit(newSelectedProductJSON);
  }

  setUpdatedProductsList(newUpdatedProductsListJSON: JSON, action: string) {
    this.updatedProductsListJSON = newUpdatedProductsListJSON;
    //console.log(this.updatedProductsListJSON)
    if (action == "add") {
      this.productAddedEvent.emit(newUpdatedProductsListJSON);
    }
    else if (action == "remove") {
      this.productRemovedEvent.emit(newUpdatedProductsListJSON);
    }
    else {
      alert("Invalid action")
    }
  }
}
