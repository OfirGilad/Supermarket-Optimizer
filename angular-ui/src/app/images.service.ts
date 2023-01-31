import { EventEmitter, Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({ providedIn: 'root' })
export class ImagesService {
    readonly APIUrl = "http://127.0.0.1:8000";

    requestServerDataEvent: EventEmitter<string> = new EventEmitter();

    constructor(
      private http: HttpClient
    ) { }

    imagesRequest(action: string, jsonParamsData, file): Observable<any[]> {
      // Getting all Images
      if (action == "GET") {
        return this.http.get<any[]>(this.APIUrl + '/Images/');
      }
      // Posting new Image
      else if (action == "POST") {
        const formData = new FormData();
        formData.append('name', jsonParamsData['name']);
        formData.append('image_name', jsonParamsData['image_name']);
        formData.append('image', file, file.name);

        return this.http.post<any[]>(this.APIUrl + '/Images/', formData);
      }
      // Deleting existing Image
      else if (action == "DELETE") {
        const options = {
          body: {
            name: jsonParamsData["name"],
            image: jsonParamsData["image"],
            image_name: jsonParamsData["image_name"],
          },
        };
        return this.http.delete<any[]>(this.APIUrl + '/Images/', options);
      }
      // Unknown
      else {
        alert("Invalid request")
        return jsonParamsData
      }
    }

    updateData(request: string) {
      console.log(request)
      this.requestServerDataEvent.emit(request);
    }
}