export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T; //So TypeScript stops complaining even if data is optional in the type:
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };  
}

export class SuccessResponseHandler {
  //generic base response
  static success<T>(message: string, data?: T, meta?: any): ApiResponse<T> {
    return {
      success: true,
      message,
      ...(data !== undefined && { data }),
      ...(meta && { meta }),
    };
  }

  //CRUD OPERATIONS
  static created<T>(resource: string, data?: T): ApiResponse<T> {
    return this.success(`${resource} created successfully`, data);
  }

  static uploaded<T>(resource: string, data?: T): ApiResponse<T> {
    return this.success(`${resource} uploaded successfully`, data);
  }

  static saved<T>(resource: string, data?: T): ApiResponse<T> {
    return this.success(`${resource} saved successfully`, data);
  }

  static login<T>(resource: string, data?: T): ApiResponse<T> {
    return this.success(`${resource} login successfully`, data);
  }
  static updated<T>(resource: string, data?: T): ApiResponse<T> {
    return this.success(`${resource} updated successfully`, data);
  }
  static deleted<T>(resource: string, data?: T): ApiResponse<T> {
    return this.success(`${resource} deleted successfully`, data);
  }
  static retrived<T>(
    resource: string,
 
    data?: T,
    meta?:  any
  ): ApiResponse<T> {
    return this.success(`${resource} retrived  successfully`, data, meta);
  }
}