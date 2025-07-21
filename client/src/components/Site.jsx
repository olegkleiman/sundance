import React , { useContext } from 'react';
import { Routes, Route, useMatch, useNavigate } from 'react-router-dom';
import { Container,
    Row, Col
} from "reactstrap";

const Site = () => {

    const navigate = useNavigate();

    return (<>
        <Container>
            <Row>
                <Col>
                    <div>Welcome to SunDance</div>
                </Col>
            </Row>
        </Container>
    </>);
};

export default Site;
