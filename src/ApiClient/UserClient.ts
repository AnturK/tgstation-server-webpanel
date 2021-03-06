import { TypedEmitter } from "tiny-typed-emitter/lib";

import { AdministrationRights, InstanceManagerRights } from "./generatedcode/_enums";
import { Components } from "./generatedcode/_generated";
import InternalError, { ErrorCode, GenericErrors } from "./models/InternalComms/InternalError";
import InternalStatus, { StatusCode } from "./models/InternalComms/InternalStatus";
import ServerClient from "./ServerClient";
import LoginHooks from "./util/LoginHooks";

interface IEvents {
    loadUserInfo: (user: InternalStatus<Components.Schemas.User, GenericErrors>) => void;
}

export type EditUserErrors = GenericErrors | ErrorCode.USER_NOT_FOUND;
export type GetUserErrors = GenericErrors | ErrorCode.USER_NOT_FOUND;
export type CreateUserErrors = GenericErrors | ErrorCode.USER_NO_SYS_IDENT;

//https://stackoverflow.com/questions/40510611/typescript-interface-require-one-of-two-properties-to-exist
//name describes what it does, makes the passed type only require 1 property, the others being optional
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
    {
        [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
    }[Keys];

export default new (class UserClient extends TypedEmitter<IEvents> {
    private _cachedUser?: InternalStatus<Components.Schemas.User, ErrorCode.OK>;
    public get cachedUser() {
        return this._cachedUser;
    }
    private loadingUserInfo = false;
    //If set to true, all created users will default to having all permissions granted, used by the setup
    public createAllUsersWithAA = false;

    public constructor() {
        super();
        this.getCurrentUser = this.getCurrentUser.bind(this);

        LoginHooks.addHook(() => this.getCurrentUser());
        ServerClient.on("purgeCache", () => {
            this._cachedUser = undefined;
        });
    }

    public async editUser(
        id: number,
        newUser: RequireAtLeastOne<Omit<Components.Schemas.UserUpdate, "id">>
    ): Promise<InternalStatus<Components.Schemas.User, EditUserErrors>> {
        await ServerClient.wait4Init();
        let response;
        try {
            response = await ServerClient.apiClient!.UserController_Update(
                null,
                Object.assign(
                    {
                        id: id
                    },
                    newUser
                ) as Components.Schemas.UserUpdate
            );
        } catch (stat) {
            return new InternalStatus({
                code: StatusCode.ERROR,
                error: stat as InternalError<EditUserErrors>
            });
        }
        // noinspection DuplicatedCode
        switch (response.status) {
            case 200: {
                const current = await this.getCurrentUser();
                if (current.code == StatusCode.OK) {
                    if (current.payload.id! == id) {
                        //if we are editing ourselves, clear cached data to reload permissions on the app
                        ServerClient.emit("purgeCache");
                    }
                } else {
                    return new InternalStatus({
                        code: StatusCode.ERROR,
                        error: current.error
                    });
                }
                return new InternalStatus({
                    code: StatusCode.OK,
                    payload: response.data as Components.Schemas.User
                });
            }
            case 404: {
                const errorMessage = response.data as Components.Schemas.ErrorMessage;
                return new InternalStatus({
                    code: StatusCode.ERROR,
                    error: new InternalError(ErrorCode.USER_NOT_FOUND, { errorMessage })
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

    public async getCurrentUser(
        bypassCache?: boolean
    ): Promise<InternalStatus<Components.Schemas.User, GenericErrors>> {
        await ServerClient.wait4Init();
        if (this._cachedUser && !bypassCache) {
            return this._cachedUser;
        }

        if (this.loadingUserInfo) {
            return await new Promise(resolve => {
                const resolver = (user: InternalStatus<Components.Schemas.User, GenericErrors>) => {
                    resolve(user);
                    this.removeListener("loadUserInfo", resolver);
                };
                this.on("loadUserInfo", resolver);
            });
        }

        this.loadingUserInfo = true;

        let response;
        try {
            response = await ServerClient.apiClient!.UserController_Read();
        } catch (stat) {
            const res = new InternalStatus<Components.Schemas.User, GenericErrors>({
                code: StatusCode.ERROR,
                error: stat as InternalError<GenericErrors>
            });
            this.emit("loadUserInfo", res);
            this.loadingUserInfo = false;
            return res;
        }

        switch (response.status) {
            case 200: {
                const thing = new InternalStatus<Components.Schemas.User, ErrorCode.OK>({
                    code: StatusCode.OK,
                    payload: response.data as Components.Schemas.User
                });

                this._cachedUser = thing;
                this.emit("loadUserInfo", thing);
                this.loadingUserInfo = false;
                return thing;
            }
            default: {
                const res = new InternalStatus<
                    Components.Schemas.User,
                    ErrorCode.UNHANDLED_RESPONSE
                >({
                    code: StatusCode.ERROR,
                    error: new InternalError(
                        ErrorCode.UNHANDLED_RESPONSE,
                        { axiosResponse: response },
                        response
                    )
                });
                this.emit("loadUserInfo", res);
                this.loadingUserInfo = false;
                return res;
            }
        }
    }

    public async listUsers(): Promise<InternalStatus<Components.Schemas.User[], GenericErrors>> {
        await ServerClient.wait4Init();

        let response;
        try {
            response = await ServerClient.apiClient!.UserController_List({
                page: 1,
                pageSize: 100
            });
        } catch (stat) {
            return new InternalStatus({
                code: StatusCode.ERROR,
                error: stat as InternalError<GenericErrors>
            });
        }

        switch (response.status) {
            case 200: {
                const payload = (response.data as Components.Schemas.PaginatedUser)!.content.sort(
                    (a, b) => a.id! - b.id!
                );

                return new InternalStatus({
                    code: StatusCode.OK,
                    payload
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

    public async getUser(
        id: number
    ): Promise<InternalStatus<Components.Schemas.User, GetUserErrors>> {
        await ServerClient.wait4Init();

        let response;
        try {
            response = await ServerClient.apiClient!.UserController_GetId({ id: id });
        } catch (stat) {
            return new InternalStatus({
                code: StatusCode.ERROR,
                error: stat as InternalError<GenericErrors>
            });
        }
        // noinspection DuplicatedCode
        switch (response.status) {
            case 200: {
                return new InternalStatus({
                    code: StatusCode.OK,
                    payload: response.data as Components.Schemas.User
                });
            }
            case 404: {
                const errorMessage = response.data as Components.Schemas.ErrorMessage;
                return new InternalStatus({
                    code: StatusCode.ERROR,
                    error: new InternalError(ErrorCode.USER_NOT_FOUND, { errorMessage })
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

    public async createUser(
        newuser:
            | {
                  name: string;
                  password: string;
                  enabled?: boolean;
                  instanceManagerRights?: InstanceManagerRights;
                  administrationRights?: AdministrationRights;
              }
            | {
                  systemIdentifier: string;
                  enabled?: boolean;
                  instanceManagerRights?: InstanceManagerRights;
                  administrationRights?: AdministrationRights;
              }
    ): Promise<InternalStatus<Components.Schemas.User, CreateUserErrors>> {
        await ServerClient.wait4Init();

        if (newuser.enabled === undefined) newuser.enabled = true;
        if (this.createAllUsersWithAA) {
            newuser.instanceManagerRights = 0;
            newuser.administrationRights = 0;

            for (const perm of Object.values(InstanceManagerRights)) {
                if (typeof perm !== "number") continue;
                newuser.instanceManagerRights += perm;
            }

            for (const perm of Object.values(AdministrationRights)) {
                if (typeof perm !== "number") continue;
                newuser.administrationRights += perm;
            }
        }

        let response;
        try {
            response = await ServerClient.apiClient!.UserController_Create(
                null,
                newuser as Components.Schemas.UserUpdate
            );
        } catch (stat) {
            return new InternalStatus({
                code: StatusCode.ERROR,
                error: stat as InternalError<GenericErrors>
            });
        }

        switch (response.status) {
            case 201: {
                return new InternalStatus({
                    code: StatusCode.OK,
                    payload: response.data as Components.Schemas.User
                });
            }
            case 410: {
                const errorMessage = response.data as Components.Schemas.ErrorMessage;
                return new InternalStatus({
                    code: StatusCode.ERROR,
                    error: new InternalError(ErrorCode.USER_NO_SYS_IDENT, { errorMessage })
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
