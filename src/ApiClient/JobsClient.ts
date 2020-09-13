import ServerClient from "./ServerClient";
import InternalStatus, { StatusCode } from "./models/InternalComms/InternalStatus";
import InternalError, { ErrorCode, GenericErrors } from "./models/InternalComms/InternalError";
import { Components } from "./generatedcode/_generated";

export type listJobsErrors = GenericErrors;
export type getJobErrors = GenericErrors | ErrorCode.JOB_JOB_NOT_FOUND;

export default new (class JobsClient {
    public async listJobs(
        instanceid: number
    ): Promise<InternalStatus<Components.Schemas.Job[], listJobsErrors>> {
        await ServerClient.wait4Init();

        let response;
        try {
            response = await ServerClient.apiClient!.JobController_Read({ Instance: instanceid });
        } catch (stat) {
            return new InternalStatus<Components.Schemas.Job[], listJobsErrors>({
                code: StatusCode.ERROR,
                error: stat as InternalError<GenericErrors>
            });
        }

        switch (response.status) {
            case 200: {
                return new InternalStatus<Components.Schemas.Job[], listJobsErrors>({
                    code: StatusCode.OK,
                    payload: response.data as Components.Schemas.Job[]
                });
            }
            default: {
                return new InternalStatus<Components.Schemas.Job[], listJobsErrors>({
                    code: StatusCode.ERROR,
                    error: new InternalError(
                        ErrorCode.UNHANDLED_RESPONSE,
                        { axiosResponse: response },
                        response
                    )
                });
            }
        }
    }

    public async getJob(
        instanceid: number,
        jobid: number
    ): Promise<InternalStatus<Components.Schemas.Job, getJobErrors>> {
        await ServerClient.wait4Init();

        let response;
        try {
            response = await ServerClient.apiClient!.JobController_GetId({
                Instance: instanceid,
                id: jobid
            });
        } catch (stat) {
            return new InternalStatus({
                code: StatusCode.ERROR,
                error: stat as InternalError<GenericErrors>
            });
        }

        switch (response.status) {
            case 200: {
                return new InternalStatus({
                    code: StatusCode.OK,
                    payload: response.data as Components.Schemas.Job
                });
            }
            case 404: {
                return new InternalStatus({
                    code: StatusCode.ERROR,
                    error: new InternalError(ErrorCode.JOB_JOB_NOT_FOUND, {
                        errorMessage: response.data as Components.Schemas.ErrorMessage
                    })
                });
            }
            default: {
                return new InternalStatus({
                    code: StatusCode.ERROR,
                    error: new InternalError(
                        ErrorCode.UNHANDLED_RESPONSE,
                        { axiosResponse: response },
                        response
                    )
                });
            }
        }
    }
})();