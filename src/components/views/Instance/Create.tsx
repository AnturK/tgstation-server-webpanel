import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import { FormattedMessage } from "react-intl";
import { RouteComponentProps, withRouter } from "react-router-dom";

import { Components } from "../../../ApiClient/generatedcode/_generated";
import InstanceClient from "../../../ApiClient/InstanceClient";
import InternalError, { ErrorCode } from "../../../ApiClient/models/InternalComms/InternalError";
import { StatusCode } from "../../../ApiClient/models/InternalComms/InternalStatus";
import ServerClient from "../../../ApiClient/ServerClient";
import { AppRoutes, RouteData } from "../../../utils/routes";
import ErrorAlert from "../../utils/ErrorAlert";
import Loading from "../../utils/Loading";

interface IState {
    loading: boolean;
    errors: Array<InternalError<ErrorCode> | undefined>;
    instanceName?: string;
    instancePath?: string;
    serverInformation?: Components.Schemas.ServerInformation;
    prefix?: string;
}

interface IProps extends RouteComponentProps {}

export default withRouter(
    class InstanceCreate extends React.Component<IProps, IState> {
        public constructor(props: IProps) {
            super(props);
            this.state = {
                loading: true,
                errors: []
            };

            this.submit = this.submit.bind(this);
        }

        private addError(error: InternalError<ErrorCode>): void {
            this.setState(prevState => {
                const errors = Array.from(prevState.errors);
                errors.push(error);
                return {
                    errors
                };
            });
        }

        public async componentDidMount() {
            const serverInformationStatus = await ServerClient.getServerInfo();
            if (serverInformationStatus.code !== StatusCode.OK) {
                this.setState({
                    loading: false
                });
                this.addError(serverInformationStatus.error);
            } else {
                const serverInformation = serverInformationStatus.payload;
                this.setState({
                    loading: false,
                    serverInformation,
                    prefix: serverInformation.validInstancePaths?.length
                        ? serverInformation.validInstancePaths[0]
                        : undefined
                });
            }
        }

        public render(): React.ReactNode {
            if (this.state.loading) {
                return <Loading text="view.instance.create.loading" />;
            }

            const validInstancePaths = this.state.serverInformation?.validInstancePaths;
            return (
                <div className="text-center">
                    {this.state.errors.map((err, index) => {
                        if (!err) return;
                        return (
                            <ErrorAlert
                                key={index}
                                error={err}
                                onClose={() =>
                                    this.setState(prev => {
                                        const newarr = Array.from(prev.errors);
                                        newarr[index] = undefined;
                                        return {
                                            errors: newarr
                                        };
                                    })
                                }
                            />
                        );
                    })}
                    <h3>
                        <FormattedMessage id="view.instance.create.title" />
                    </h3>
                    <Form onSubmit={this.submit}>
                        <Col className="mx-auto" lg={5} md={8}>
                            <Form.Group controlId="name">
                                <Form.Label>
                                    <h5>
                                        <FormattedMessage id="view.instance.create.name" />
                                    </h5>
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    onChange={event => {
                                        const instanceName = event.target.value;
                                        this.setState({
                                            instanceName
                                        });
                                    }}
                                    value={this.state.instanceName}
                                    required
                                />
                            </Form.Group>
                            <Form.Group controlId="path">
                                <Form.Label>
                                    <h5>
                                        <FormattedMessage id="view.instance.create.path" />
                                    </h5>
                                </Form.Label>
                                <InputGroup className="mb-1">
                                    {validInstancePaths != null ? (
                                        <InputGroup.Prepend className="flex-grow-1 flex-grow-md-0">
                                            <InputGroup.Text>
                                                <span>
                                                    <FormattedMessage id="view.instance.create.path.prefix" />
                                                </span>
                                            </InputGroup.Text>
                                            <Form.Control
                                                className="rounded-0 flex-grow-1 flex-grow-md-0 flex-shrink-0 flex-shrink-md-1 w-auto"
                                                as="select"
                                                custom
                                                required
                                                onChange={event => {
                                                    this.setState({
                                                        prefix: event.target.value
                                                    });
                                                }}>
                                                {validInstancePaths.map(validPath => {
                                                    return (
                                                        <option
                                                            key={validPath}
                                                            value={validPath}
                                                            selected={
                                                                this.state.prefix == validPath
                                                            }>
                                                            {validPath}/
                                                        </option>
                                                    );
                                                })}
                                            </Form.Control>
                                        </InputGroup.Prepend>
                                    ) : null}
                                    <Form.Control
                                        type="text"
                                        className="flex-grow-1 w-100 w-md-auto"
                                        required
                                        onChange={event => {
                                            const instancePath = event.target.value;
                                            this.setState({
                                                instancePath
                                            });
                                        }}
                                        value={this.state.instancePath}
                                    />
                                </InputGroup>
                            </Form.Group>
                            <Button type="submit" variant="success">
                                <FormattedMessage id="view.instance.create.submit" />
                            </Button>
                        </Col>
                    </Form>
                </div>
            );
        }

        private async submit() {
            //The required attribute should prevent this from ever happening but id rather not fuck over someone
            if (!this.state.instancePath) {
                return;
            }

            const instancePath =
                (this.state.prefix ? this.state.prefix + "/" : "") + this.state.instancePath;

            this.setState({
                loading: true
            });

            const result = await InstanceClient.createInstance({
                name: this.state.instanceName!,
                path: instancePath,
                id: 0
            });

            if (result.code === StatusCode.ERROR) {
                this.setState({
                    loading: false
                });
                this.addError(result.error);

                return;
            }

            RouteData.instanceid = result.payload.id.toString();

            this.props.history.push(AppRoutes.instancelist.link || AppRoutes.instancelist.route);
        }
    }
);
