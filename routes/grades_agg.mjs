import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();

/**
 * It is not best practice to seperate these routes
 * like we have done here. This file was created
 * specifically for educational purposes, to contain
 * all aggregation routes in one place.
 */

/**
 * Grading Weights by Score Type:
 * - Exams: 50%
 * - Quizes: 30%
 * - Homework: 20%
 */

// Get the number of learners with weighted average higher than 70%
router.get("/stats", async (req, res) => {

  let collection = await db.collection("grades");

  let result = await collection
    .aggregate([
      {
        $unwind: { path: "$scores" },
      },
      {
        $group: {
          _id: "$learner_id",
          quiz: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "quiz"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "exam"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "homework"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          // learner_id: "$_id",
          avg: {
            $sum: [
              { $multiply: [{ $avg: "$exam" }, 0.5] },
              { $multiply: [{ $avg: "$quiz" }, 0.3] },
              { $multiply: [{ $avg: "$homework" }, 0.2] },
            ],
          },
        },
      },
      {
        $match: {
          avg: { $gte: 70 },
        }, 
      },
    ])
    .toArray();
    console.log(result);
    const totalLearners = (await collection.distinct("learner_id")).length;
    const learnersWithOver70 = result.length;
    const percentageover70 = ((learnersWithOver70 / totalLearners) * 100).toFixed(2);
  

    if (!result) res.send("Not found").status(404);
    else res.send({learnersWithOver70, totalLearners, percentageover70}).status(200);

});

 
  router.get("/stats/:id", async (req, res) => {

    const { id } = req.params; // to extract class_id 

    // to make sure id is a number 
    const classId = parseInt(id);

    let collection = await db.collection("grades");
  
    let result = await collection
      .aggregate([
        {
          $match: { class_id: classId } 
        },
        {
          $unwind: { path: "$scores" },
        },
        {
          $group: {
            _id: "$learner_id",
            quiz: {
              $push: {
                $cond: {
                  if: { $eq: ["$scores.type", "quiz"] },
                  then: "$scores.score",
                  else: "$$REMOVE",
                },
              },
            },
            exam: {
              $push: {
                $cond: {
                  if: { $eq: ["$scores.type", "exam"] },
                  then: "$scores.score",
                  else: "$$REMOVE",
                },
              },
            },
            homework: {
              $push: {
                $cond: {
                  if: { $eq: ["$scores.type", "homework"] },
                  then: "$scores.score",
                  else: "$$REMOVE",
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            student_id: "$_id",
            avg: {
              $sum: [
                { $multiply: [{ $avg: "$exam" }, 0.5] },
                { $multiply: [{ $avg: "$quiz" }, 0.3] },
                { $multiply: [{ $avg: "$homework" }, 0.2] },
              ],
            },
          },
        },
        {
          $match: {
            avg: { $gte: 70 },
          }, 
        },
      ])
      .toArray();
      console.log(result);
      console.log("Class ID:", id);
      


      const totalLearners = (await collection.distinct("learner_id", { class_id: classId })).length;
      const learnersWithOver70 = result.length;
      const percentageover70 = ((learnersWithOver70 / totalLearners) * 100).toFixed(2);
    
  
      if (!result) res.send("Not found").status(404);
      else res.send({learnersWithOver70, totalLearners, percentageover70}).status(200);
  
  });



async function createIndexes() {

  let collection = await db.collection("grades"); 
// Create a single-field index on class_id
await collection.createIndex({ class_id: 1 });

// Create a single-field index on learner_id
await collection.createIndex({ learner_id: 1 });

// Create a compound index on learner_id and class_id (here both are ascending)
await collection.createIndex({ learner_id: 1, class_id: 1 });

}

createIndexes();



// db.createCollection("grades", {
//   validator: {
//      $jsonSchema: {
//         bsonType: "object",
//         title: "Grade Object Validation",
//         required: [ "class_id", "learner_id" ],
//         properties: {
          
//            class_id: {
//               bsonType: "int",
//               minimum: 0,
//               maximum: 300,
//               description: "'class_id' must be an integer in [ 0, 300 ] and is required"
//            },
//            learner_id: {
//               bsonType: "int",
//               minimum: 0,
//               description: "'learner_id' must be a integer greater than or equal to 0"
//            }
//         }
//      }
//   },
//   validationAction: "warn"
// } );


// the above code is not working 
// as we already have the grades collection so we want to just add the validation rules, 
// we will use the following method to modify the grades collection

async function updateValidationRules() {

    //  the collMod command is used here to update the validation rules
    const result = 
    await db.command({
      collMod: "grades",
      validator: {
         $jsonSchema: {
            bsonType: "object",
            title: "Grade Object Validation",
            required: [ "class_id", "learner_id" ],
            properties: {
              
               class_id: {
                  bsonType: "int",
                  minimum: 0,
                  maximum: 300,
                  description: "'class_id' must be an integer in [ 0, 300 ] and is required"
               },
               learner_id: {
                  bsonType: "int",
                  minimum: 0,
                  description: "'learner_id' must be a integer greater than or equal to 0"
               }
            }
         }
      },
      validationAction: "warn"
    });
    
};

updateValidationRules();
// the above function was tested in the mongoshell accrodingly and it is working 


// Get the weighted average of a specified learner's grades, per class
router.get("/learner/:id/avg-class", async (req, res) => {
  let collection = await db.collection("grades");

  let result = await collection
    .aggregate([
      {
        $match: { learner_id: Number(req.params.id) },
      },
      {
        $unwind: { path: "$scores" },
      },
      {
        $group: {
          _id: "$class_id",
          quiz: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "quiz"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          exam: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "exam"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
          homework: {
            $push: {
              $cond: {
                if: { $eq: ["$scores.type", "homework"] },
                then: "$scores.score",
                else: "$$REMOVE",
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          class_id: "$_id",
          avg: {
            $sum: [
              { $multiply: [{ $avg: "$exam" }, 0.5] },
              { $multiply: [{ $avg: "$quiz" }, 0.3] },
              { $multiply: [{ $avg: "$homework" }, 0.2] },
            ],
          },
        },
      },
    ])
    .toArray();

  if (!result) res.send("Not found").status(404);
  else res.send(result).status(200);
});

export default router;
