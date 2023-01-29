import { EventEmitter, Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ProductsListService {
  requestPathEvent: EventEmitter<JSON> = new EventEmitter();
  selectedProductEvent: EventEmitter<JSON> = new EventEmitter();
  productsJSON: JSON;
  recentProductStatus: JSON;

  setProducts(newProductsJSON: JSON) {
      this.productsJSON = newProductsJSON;
      //console.log(this.productsJSON)
      this.requestPathEvent.emit(newProductsJSON);
  }

  setSelectedProduct(newSelectedProductJSON: JSON) {
    this.recentProductStatus = newSelectedProductJSON;
    //console.log(this.recentProductStatus)
    this.selectedProductEvent.emit(newSelectedProductJSON);
}

  getProducts() {
      return this.productsJSON;
  }
}
