import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid';
import mailgun from 'mailgun-js';
import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize(process.env.DB, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.HOST,
  dialect: 'mysql',
  timezone: '+00:00',
});

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  account_created: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  account_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: true,
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  validity: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  timestamps: false,
});

const mg = mailgun({
  apiKey: 'd6fba5dc7e62e2c6cac695f04613b321-309b0ef4-621410c1',
  domain: 'centralhub.me'
});

const pubsub = new PubSub();
const currentTime = new Date();

export const processNewUser = async (event, context) => {
  const pubsubMessage = event.data ? JSON.parse(Buffer.from(event.data, 'base64').toString()) : {};
  const { id, username } = pubsubMessage;
  const token = uuidv4();
  await VerificationEmail(username, token);
  const validity = new Date(Date.now() + 2 * 60 * 1000);
  await updateDatabase(username, token, validity);
  console.log(`Verification email sent to ${username}`);
};

const VerificationEmail = async (username, token) => {
  try {
    const apiKey = "d6fba5dc7e62e2c6cac695f04613b321-309b0ef4-621410c1";
    const domain = "centralhub.me";
    const sender = "mail@centralhub.me";
    const data = {
      from: sender,
      to: username,
      subject: 'Email Verification',
      text: `Please click the following link to verify your email: ${VerificationLink(username, token)}`,
    };
    const body = await mg.messages().send(data);
    console.log('Mailgun response:', body);
  } catch (error) {
    console.error('Error sending verification email:', error.message);
    throw error;
  }
};

const VerificationLink = (username, token) => {
  const baseUrl = 'http://centralhub.me:8080';
  const verificationLink = `${baseUrl}/verify?username=${username}&token=${token}`;
  return verificationLink;
};

const updateDatabase = async (username, token, validity) => {
  try {
    const [rowsAffected] = await User.update(
      { token: token, validity: validity },
      { where: { username: username } }
    );
    console.log(`Updated ${rowsAffected} row(s)`);
  } catch (error) {
    console.error('Error updating database:', error);
    throw error;
  }
};
