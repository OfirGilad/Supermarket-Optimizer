import { EventEmitter, Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ProductsListService {
  requestPathEvent: EventEmitter<JSON> = new EventEmitter();
  productsJSON: JSON;

  setProducts(newProductsJSON: JSON) {
      this.productsJSON = newProductsJSON;
      console.log(this.productsJSON)
      this.requestPathEvent.emit(newProductsJSON);
  }

  getProducts() {
      return this.productsJSON;
  }
}
