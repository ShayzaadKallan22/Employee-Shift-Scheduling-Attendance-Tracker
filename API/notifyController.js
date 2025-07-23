/**
 * @author MOYO CT, 221039267
 * @version API_mobile
 */

const db = require('./db');
//Fetch the employee's notifications
exports.getEmpNotifications = async (req , res) =>{

    const {employeeId} = req.params;

    try{
       const [notifications] = await db.query(
        `SELECT n.notification_id, n.message, n.sent_time, n.read_status, t._name AS type
         FROM t_notification n
         JOIN t_notification_type t ON n.notification_type_id = t.notification_type_id
         WHERE n.employee_id = ? 
         ORDER BY n.sent_time DESC`, [employeeId]
       );
      
        res.status(200).json(notifications);
    }catch(err){
       console.error("Error fetching notifcations.", err);
       res.status(500).json({error: "Server error"});
    }
};

exports.markAsRead = async (req, res) =>{

    const {notificationId} = req.params;

    try {
        await db.query(
            `UPDATE t_notification SET read_status = 'read' WHERE notification_id = ?`,
             [notificationId]
        );
        res.status(200).json({message: "Notification marked as read"});
    }catch(err){
        console.error("Error updating notification:", err);
        res.status(500).json({error: "Server error"});
    }
}