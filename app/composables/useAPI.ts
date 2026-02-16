import CapModule from '#capModule';

export default class useAPI {
    private capAPI = useCapApi();
    private appCode: string | null = CapModule.extra?.AppCode ?? null;
    private authorization = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VySWQiOiIyMWZiNDcyZC02ZTFlLTRmNTQtZmIyZC0wOGRhNmVkNmJjYzUiLCJVc2VybmFtZSI6ImVldGV6YWRpIiwianRpIjoiNzZiNzUzOTAtZWRkNy00M2Y0LWI3YzAtYWVhM2I1NDNiZmU1IiwiQXBwSWQiOiIyYTdmMjRjZS1mZDVlLTQwNWMtOWE2My1mMDdlNGY2NTFjY2EiLCJSb2xlIjoiZGVmYXVsdCIsIlBlcm1pc3Npb24iOlsiVmlldyIsIlJlcG9ydFZpZXciLCJPd25lciIsIkVkaXRBZG1pbiIsIkNyZWF0ZUFkbWluIiwiVmFsaWRhdG9yIiwiRXhoaWJpdFZpc2l0b3IiLCJFeGhpYml0UmVwb3J0IiwiU3VwZXJBZG1pbiJdLCJleHAiOjE3NzEzMzIwNTZ9.Tvh4atMopzBES6qWdKWXaaQfMkM6dAdIaFJKjxqDYDc'

    public getCompanies = async (id:string = '0') => {
        try {
            const api = await this.capAPI.useAPI();
            let _data :any[] = [];
            const { data } = await api({
                method: "post",
                url: "/V1/Exhibits/GetAllParticipants",
                headers: {
                    AppCode: this.appCode || '',
                },
                data: {
                    ExhibitId: id,
                    type: 1,
                    PageNumber: 1,
                    PageSize: 500,
                    Sort: 'desc',
                    SortBy: 'CreatedAt',
                },
            });
            data.data.forEach((e: any) => {
                _data.push({
                    id: e.id,
                    code: e.code,
                    locationID: +e.location.id,
                    logo: e.location.images[0]?.url,
                    title: e.location.title,
                    workFields: e.workFields.map((it:any)=>it.title),
                    organ: {
                        id: e.organ.id,
                        title: e.organ.title,
                        ceo: e.organ.ceoName,
                    },
                });
            });
            return { result: true, msg: "Success", data: _data };
        } catch (e) {
            console.error(e);
            return { result: false, msg: "ERROR" };
        }
    };
    public getExhibit = async (id:string = '0') => {
        try {
            const api = await this.capAPI.useAPI();
            let _data :any = null;
            const { data } = await api({
                method: "get",
                url: `/V1/Exhibits/${id}`,
                headers: {
                    AppCode: this.appCode || '',
                }
            });
            if (data.isSuccess){
                _data = {
                    id : data.exhibit.id,
                    code : data.exhibit.code,
                    title : data.exhibit.title,
                    poster : data.exhibit.poster,
                    workFields : data.exhibit.workFields,
                }
            }
            return { result: true, msg: "Success", data: _data };
        } catch (e) {
            console.error(e);
            return { result: false, msg: "ERROR" };
        }
    };
    public getMap = async (id:string = '0') => {
        try {
            const api = await this.capAPI.useAPI();
            const { data } = await api({
                method: "get",
                url: `/V1/Exhibits/GetMapSVG/${id}`,
                headers: {
                    AppCode: this.appCode || '',
                }
            });
            return { result: true, msg: "Success", data };
        } catch (e) {
            console.error(e);
            return { result: false, msg: "ERROR" };
        }
    };
    public saveMap = async (id:string = '0',mapData:string = '',assigns:any[] = []) => {
        try {
            const api = await this.capAPI.useAPI();
            const { data } = await api({
                method: "put",
                url: `/V1/Exhibits/EditMapSVG`,
                headers: {
                    AppCode: this.appCode || '',
                    authorization : this.authorization,
                },
                data:{
                    "exhibitId": id,
                    "url": mapData,
                    "assigns": assigns,
                }
            });
            return { result: true, msg: "Success", data };
        } catch (e) {
            console.error(e);
            return { result: false, msg: "ERROR" };
        }
    };
    public upload = async (file: FormData) => {
        try {
            const capAPI = useCapApi();
            const { data } = await (await capAPI.useAPI())({
                method: 'post',
                url: 'UploadFile/Upload',
                params: {},
                data: file,
                headers: {
                    authorization : this.authorization,
                    AppCode: this.appCode || '',
                    'Content-Type': 'multipart/form-data'
                }
            })
            return {result: true, msg: 'Success', data}
        } catch (e) {
            console.log('data : ERROR',)
            return {result: false, msg: 'UnSuccess'}
        }
    }
}
