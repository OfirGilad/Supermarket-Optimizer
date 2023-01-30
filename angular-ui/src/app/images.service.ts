import { EventEmitter, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({ providedIn: 'root' })
export class ImagesService {
    readonly APIUrl = "http://127.0.0.1:8000";

    requestServerDataEvent: EventEmitter<string> = new EventEmitter();

    constructor(
      private http: HttpClient
    ) { }

    getImages(): Observable<any[]> {
      return this.http.get<any[]>(this.APIUrl + '/Images/');
    }

    updateData(request: string) {
      console.log(request)
      this.requestServerDataEvent.emit(request);
    }
     
}