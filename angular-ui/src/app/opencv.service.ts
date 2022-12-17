import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";


@Injectable({
    providedIn: 'root'
})
export class OpenCVService {
    readonly APIUrl = "http://127.0.0.1:8000";

    constructor(
        private http: HttpClient
    ) { }

    getOpenCVResult(jsonParamsData: JSON): Observable<any[]>{
        
        return this.http.post<any[]>(this.APIUrl + '/openCVHandler/', jsonParamsData);
    }
}